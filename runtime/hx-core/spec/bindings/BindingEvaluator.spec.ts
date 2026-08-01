import { BindingEvaluator, Converter, ConverterRegistry, DIContainer, FrameworkElement } from "@heleonix/hx-core"
import type { IBindingExpression } from "@heleonix/hx-language"

class FakeConfigDefinitionProvider extends FrameworkElement {
  public static get diName(): string {
    return "ConfigDefinitionProvider"
  }

  public getDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { size: `cfg:${name}.size` } })
  }
}

class FakeDictionaryDefinitionProvider extends FrameworkElement {
  public static get diName(): string {
    return "DictionaryDefinitionProvider"
  }

  public getDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { hello: `${name}: hi {name}` } })
  }
}

class UpperConverter extends Converter<string, string> {
  public static get diName(): string {
    return "UpperConverter"
  }

  public format(value: string): Promise<string> {
    return Promise.resolve(String(value).toUpperCase())
  }

  public parse(value: string): Promise<string> {
    return Promise.resolve(value)
  }
}

// A reversible, parameterized converter to exercise argument resolution and the
// parse chain (format appends the arg, parse strips it back off).
class SuffixConverter extends Converter<string, string, { text: string }> {
  public static get diName(): string {
    return "SuffixConverter"
  }

  public format(value: string, params: { text: string }): Promise<string> {
    return Promise.resolve(`${String(value)}${params.text}`)
  }

  public parse(value: string, params: { text: string }): Promise<string> {
    return Promise.resolve(value.endsWith(params.text) ? value.slice(0, -params.text.length) : value)
  }
}

function evaluatorWith(): BindingEvaluator {
  const container = new DIContainer()

  container.registerInjectables([
    BindingEvaluator,
    ConverterRegistry,
    FakeConfigDefinitionProvider,
    FakeDictionaryDefinitionProvider,
    UpperConverter,
    SuffixConverter,
  ] as never[])

  return container.inject<BindingEvaluator>("BindingEvaluator")
}

describe("BindingEvaluator", () => {
  describe("resolve", () => {
    it("then resolves the source, then applies the format chain left to right", async () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: '!')", "Upper"] }

      const result = await evaluatorWith().resolve(binding, (path) => (path === "name" ? "bob" : undefined))

      expect(result).toBe("BOB!")
    })

    it("then resolves each converter argument as its own binding source", async () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: extra)"] }

      const result = await evaluatorWith().resolve(binding, (path) => ({ name: "bob", extra: "?" })[path])

      expect(result).toBe("bob?")
    })

    it("then returns the bare source when there are no converters", async () => {
      const binding: IBindingExpression = { type: "config", value: "UI.size" }

      expect(await evaluatorWith().resolve(binding, () => undefined)).toBe("cfg:UI.size")
    })
  })

  describe("resolveBack", () => {
    it("then applies the parse chain in reverse to recover the source value", async () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: '!')"] }

      expect(await evaluatorWith().resolveBack("bob!", binding, () => undefined)).toBe("bob")
    })
  })

  describe("getDictionaryValue", () => {
    it("then interpolates a template's expressions against the state getter", async () => {
      const value = await evaluatorWith().getDictionaryValue("Greet.hello", (path) => (path === "name" ? "bob" : ""))

      expect(value).toBe("Greet: hi bob")
    })
  })

  describe("dependencies", () => {
    it("then lists the state source and every state-typed converter argument", () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: extra)"] }

      expect(evaluatorWith().dependencies(binding)).toEqual(["name", "extra"])
    })

    it("then omits dictionary/config sources and literal arguments", () => {
      const binding: IBindingExpression = { type: "dictionary", value: "D.k", converters: ["Suffix(text: '!')"] }

      expect(evaluatorWith().dependencies(binding)).toEqual([])
    })
  })
})
