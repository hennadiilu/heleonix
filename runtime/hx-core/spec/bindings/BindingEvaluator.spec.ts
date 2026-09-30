import {
  BindingEvaluator,
  ConfigValueSource,
  Converter,
  DictionaryValueSource,
  LiteralValueSource,
  StateValueSource,
} from "@heleonix/hx-core"
import { ConverterProvider } from "../../src/converters/ConverterProvider"
import { StateManager } from "../../src/state/StateManager"
import type { ConverterConstructor, IConverterContext } from "@heleonix/hx-core"
import { joinFQPropertyName } from "@heleonix/hx-language"
import type { IBindingExpression } from "@heleonix/hx-language"

class FakeConfigDefinitionLoader {
  public loadDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { size: `cfg:${name}.size` } })
  }
}

class FakeDictionaryDefinitionLoader {
  public loadDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { hello: `${name}: hi {name}` } })
  }
}

class UpperConverter extends Converter<string, string> {
  public static readonly hxName = "Upper"

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
  public static readonly hxName = "Suffix"

  public format(value: string, params: { text: string }): Promise<string> {
    return Promise.resolve(`${String(value)}${params.text}`)
  }

  public parse(value: string, params: { text: string }): Promise<string> {
    return Promise.resolve(value.endsWith(params.text) ? value.slice(0, -params.text.length) : value)
  }
}

function evaluatorWith(state: StateManager = new StateManager()): BindingEvaluator {
  const converterProvider = new ConverterProvider(
    new Map<string, ConverterConstructor>([
      ["Upper", UpperConverter],
      ["Suffix", SuffixConverter],
    ]),
    () => ({}) as IConverterContext,
  )

  return new BindingEvaluator(converterProvider, [
    new StateValueSource(state),
    new LiteralValueSource(),
    new ConfigValueSource(new FakeConfigDefinitionLoader() as never),
    new DictionaryValueSource(new FakeDictionaryDefinitionLoader() as never),
  ])
}

describe("BindingEvaluator", () => {
  describe("resolve", () => {
    it("then resolves the source, then applies the format chain left to right", async () => {
      const state = new StateManager()
      state.setValue(joinFQPropertyName("app", "name"), "bob")

      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: '!')", "Upper"] }

      expect(await evaluatorWith(state).resolve(binding, "app")).toBe("BOB!")
    })

    it("then resolves each converter argument as its own binding source", async () => {
      const state = new StateManager()
      state.setValue(joinFQPropertyName("app", "name"), "bob")
      state.setValue(joinFQPropertyName("app", "extra"), "?")

      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: extra)"] }

      expect(await evaluatorWith(state).resolve(binding, "app")).toBe("bob?")
    })

    it("then returns the bare source when there are no converters", async () => {
      const binding: IBindingExpression = { type: "config", value: "UI.size" }

      expect(await evaluatorWith().resolve(binding, "app")).toBe("cfg:UI.size")
    })
  })

  describe("resolveBack", () => {
    it("then applies the parse chain in reverse to recover the source value", async () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: '!')"] }

      expect(await evaluatorWith().resolveBack("bob!", binding, "app")).toBe("bob")
    })
  })

  describe("dictionary resolution", () => {
    it("then interpolates a template's expressions against the scoped state", async () => {
      const state = new StateManager()
      state.setValue(joinFQPropertyName("app", "name"), "bob")

      expect(await evaluatorWith(state).resolve({ type: "dictionary", value: "Greet.hello" }, "app")).toBe(
        "Greet: hi bob",
      )
    })
  })

  describe("collectParameters", () => {
    it("then lists the fully-qualified state source and every state-typed converter argument", async () => {
      const binding: IBindingExpression = { type: "state", value: "name", converters: ["Suffix(text: extra)"] }

      expect(await evaluatorWith().collectParameters(binding, "app")).toEqual([
        joinFQPropertyName("app", "name"),
        joinFQPropertyName("app", "extra"),
      ])
    })

    it("then descends into a dictionary template to collect its state parameters", async () => {
      const binding: IBindingExpression = { type: "dictionary", value: "Greet.hello" }

      expect(await evaluatorWith().collectParameters(binding, "app")).toEqual([joinFQPropertyName("app", "name")])
    })

    it("then returns none for a dictionary whose template has no state parameters", async () => {
      const binding: IBindingExpression = { type: "dictionary", value: "D.k", converters: ["Suffix(text: '!')"] }

      expect(await evaluatorWith().collectParameters(binding, "app")).toEqual([])
    })
  })
})
