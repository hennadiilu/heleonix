import {
  Binder,
  BindingEvaluator,
  Converter,
  ConverterRegistry,
  DIContainer,
  FrameworkElement,
} from "@heleonix/hx-core"
import { joinFQPropertyName } from "@heleonix/hx-language"
import type { IBindingExpression } from "@heleonix/hx-language"

class FakeStateManager extends FrameworkElement {
  public readonly changed = {
    on: (fq: string, handler: () => void): void => {
      let set = this.handlers.get(fq)

      if (!set) {
        this.handlers.set(fq, (set = new Set()))
      }

      set.add(handler)
    },
    off: (fq: string, handler: () => void): void => void this.handlers.get(fq)?.delete(handler),
  }

  private readonly store = new Map<string, unknown>()

  private readonly handlers = new Map<string, Set<() => void>>()

  public static get diName(): string {
    return "StateManager"
  }

  public getValue(fq: string): unknown {
    return this.store.get(fq)
  }

  public setValue(fq: string, value: unknown): void {
    this.store.set(fq, value)
    this.handlers.get(fq)?.forEach((handler) => handler())
  }

  // A bare state source binds as a symmetric alias; the spec only needs the
  // seed-on-bind behaviour, so mirror the source value into the target once.
  public bind(target: string, source: string): void {
    this.setValue(target, this.getValue(source))
  }

  public unbind(): void {}
}

class FakeDictionaryDefinitionProvider extends FrameworkElement {
  public static get diName(): string {
    return "DictionaryDefinitionProvider"
  }

  public getDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { hi: `dict:${name}.hi` } })
  }
}

class FakeConfigDefinitionProvider extends FrameworkElement {
  public static get diName(): string {
    return "ConfigDefinitionProvider"
  }

  public getDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { size: `cfg:${name}.size` } })
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

// A reversible converter (format doubles, parse halves) for two-way / chaining.
class DoubleConverter extends Converter<number, number> {
  public static get diName(): string {
    return "DoubleConverter"
  }

  public format(value: number): Promise<number> {
    return Promise.resolve(value * 2)
  }

  public parse(value: number): Promise<number> {
    return Promise.resolve(value / 2)
  }
}

function binderWith(): { binder: Binder; state: FakeStateManager } {
  const container = new DIContainer()

  container.registerInjectables([
    Binder,
    BindingEvaluator,
    ConverterRegistry,
    FakeStateManager,
    FakeDictionaryDefinitionProvider,
    FakeConfigDefinitionProvider,
    UpperConverter,
    DoubleConverter,
  ] as never[])

  return {
    binder: container.inject<Binder>("Binder"),
    state: container.inject<FakeStateManager>("StateManager"),
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const upperOf = (value: string, converters: string[]): IBindingExpression => ({ type: "state", value, converters })

describe("Binder", () => {
  it("then writes the source through the converter format chain to the target", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "name"), "bob")
    await binder.bind("Card:title", upperOf("name", ["Upper"]), "app")

    expect(state.getValue("Card:title")).toBe("BOB")
  })

  it("then recomputes reactively when the source changes", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "name"), "bob")
    await binder.bind("Card:title", upperOf("name", ["Upper"]), "app")

    state.setValue(joinFQPropertyName("app", "name"), "alice")
    await flush()

    expect(state.getValue("Card:title")).toBe("ALICE")
  })

  it("then stops recomputing once unbound", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "name"), "bob")
    await binder.bind("Card:title", upperOf("name", ["Upper"]), "app")

    binder.unbind("Card:title")
    state.setValue(joinFQPropertyName("app", "name"), "later")
    await flush()

    expect(state.getValue("Card:title")).toBe("BOB")
  })

  it("then converts a dictionary source too", async () => {
    const { binder, state } = binderWith()

    await binder.bind("Card:title", { type: "dictionary", value: "Labels.hi", converters: ["Upper"] }, "app")

    expect(state.getValue("Card:title")).toBe("DICT:LABELS.HI")
  })

  it("then parses an edited target back into a writable state source (two-way)", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "a"), 5)
    await binder.bind("app:b", { type: "state", value: "a", converters: ["Double"] }, "app")
    expect(state.getValue("app:b")).toBe(10)

    // Edit the target: it parses back through Double to the source.
    state.setValue("app:b", 20)
    await flush()

    expect(state.getValue(joinFQPropertyName("app", "a"))).toBe(10)
  })

  it("then does not parse back into a non-writable (dictionary) source", async () => {
    const { binder, state } = binderWith()

    await binder.bind("app:b", { type: "dictionary", value: "Labels.hi", converters: ["Upper"] }, "app")

    // Editing the target must not write anything back to the dictionary.
    state.setValue("app:b", "EDITED")
    await flush()

    expect(state.getValue("app:b")).toBe("EDITED")
  })

  describe("given a chain a | Double -> b | Double -> c", () => {
    async function chain(): Promise<FakeStateManager> {
      const { binder, state } = binderWith()

      // b = a | Double ; c = b | Double
      await binder.bind("app:b", { type: "state", value: "a", converters: ["Double"] }, "app")
      await binder.bind("app:c", { type: "state", value: "b", converters: ["Double"] }, "app")

      return state
    }

    it("then propagates a source change forward through both formats", async () => {
      const state = await chain()

      state.setValue(joinFQPropertyName("app", "a"), 5)
      await flush()

      expect(state.getValue("app:b")).toBe(10)
      expect(state.getValue("app:c")).toBe(20)
    })

    it("then propagates a middle change both ways (parse to source, format to dependent)", async () => {
      const state = await chain()

      state.setValue("app:b", 30)
      await flush()

      expect(state.getValue(joinFQPropertyName("app", "a"))).toBe(15)
      expect(state.getValue("app:c")).toBe(60)
    })

    it("then propagates a target change backward through both parses", async () => {
      const state = await chain()

      state.setValue("app:c", 100)
      await flush()

      expect(state.getValue("app:b")).toBe(50)
      expect(state.getValue(joinFQPropertyName("app", "a"))).toBe(25)
    })
  })
})
