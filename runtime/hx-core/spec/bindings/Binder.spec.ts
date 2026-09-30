import {
  BindingEvaluator,
  ConfigValueSource,
  Converter,
  DictionaryValueSource,
  LiteralValueSource,
  StateValueSource,
} from "@heleonix/hx-core"
import { Binder } from "../../src/bindings/Binder"
import { ConverterProvider } from "../../src/converters/ConverterProvider"
import type { ConverterConstructor, IConverterContext } from "@heleonix/hx-core"
import { joinFQPropertyName } from "@heleonix/hx-language"
import type { IBindingExpression } from "@heleonix/hx-language"

class FakeStateManager {
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

class FakeDictionaryDefinitionLoader {
  public loadDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { hi: `dict:${name}.hi` } })
  }
}

class FakeConfigDefinitionLoader {
  public loadDefinition(name: string): Promise<{ entries: Record<string, string> }> {
    return Promise.resolve({ entries: { size: `cfg:${name}.size` } })
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

// A reversible converter (format doubles, parse halves) for two-way / chaining.
class DoubleConverter extends Converter<number, number> {
  public static readonly hxName = "Double"

  public format(value: number): Promise<number> {
    return Promise.resolve(value * 2)
  }

  public parse(value: number): Promise<number> {
    return Promise.resolve(value / 2)
  }
}

// A synchronous reversible converter: returns values directly, no promise.
class SyncDoubleConverter extends Converter<number, number> {
  public static readonly hxName = "SyncDouble"

  public format(value: number): number {
    return value * 2
  }

  public parse(value: number): number {
    return value / 2
  }
}

function binderWith(): { binder: Binder; state: FakeStateManager } {
  const state = new FakeStateManager()
  const converterProvider = new ConverterProvider(
    new Map<string, ConverterConstructor>([
      ["Upper", UpperConverter],
      ["Double", DoubleConverter],
      ["SyncDouble", SyncDoubleConverter],
    ]),
    () => ({}) as IConverterContext,
  )

  const evaluator = new BindingEvaluator(converterProvider, [
    new StateValueSource(state as never),
    new LiteralValueSource(),
    new ConfigValueSource(new FakeConfigDefinitionLoader() as never),
    new DictionaryValueSource(new FakeDictionaryDefinitionLoader() as never),
  ])

  return { binder: new Binder(state as never, evaluator), state }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const upperOf = (value: string, converters: string[]): IBindingExpression => ({ type: "state", value, converters })

describe("Binder", () => {
  it("then a synchronous converter recomputes in the same tick, without a microtask", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "n"), 5)
    await binder.bind("app:m", { type: "state", value: "n", converters: ["SyncDouble"] }, "app")
    expect(state.getValue("app:m")).toBe(10)

    // No flush: a sync converter must write the target within setValue itself.
    state.setValue(joinFQPropertyName("app", "n"), 7)
    expect(state.getValue("app:m")).toBe(14)
  })

  it("then parses a sync converter back into the source synchronously (two-way)", async () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "n"), 5)
    await binder.bind("app:m", { type: "state", value: "n", converters: ["SyncDouble"] }, "app")

    state.setValue("app:m", 20)
    expect(state.getValue(joinFQPropertyName("app", "n"))).toBe(10)
  })

  it("then binds a bare state source synchronously (no promise)", () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "a"), 3)
    const result = binder.bind("app:b", { type: "state", value: "a" }, "app")

    expect(result instanceof Promise).toBe(false)
    expect(state.getValue("app:b")).toBe(3)
  })

  it("then binds a synchronous converter binding synchronously (no promise)", () => {
    const { binder, state } = binderWith()

    state.setValue(joinFQPropertyName("app", "n"), 5)
    const result = binder.bind("app:m", { type: "state", value: "n", converters: ["SyncDouble"] }, "app")

    expect(result instanceof Promise).toBe(false)
    expect(state.getValue("app:m")).toBe(10)
  })

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

  describe("given the endpoints a binding reaches components by", () => {
    it("then activates both ends of a plain state edge", () => {
      const { binder } = binderWith()
      const activated: string[] = []

      binder.endpointActivated.on("Card", (_componentFQ, localPath) => activated.push(localPath))
      void binder.bind("Card:title", { type: "state", value: "name" }, "app")

      expect(activated).toEqual(["title"])
      expect(binder.getActiveEndpoints("app")).toEqual(["name"])
    })

    it("then activates the target of a converted binding, which reaches no state edge", async () => {
      const { binder } = binderWith()
      const activated: string[] = []

      binder.endpointActivated.on("Input", (_componentFQ, localPath) => activated.push(localPath))
      await binder.bind("Input:click", upperOf("name", ["Upper"]), "app")

      expect(activated).toEqual(["click"])
    })

    it("then a literal write reaches no component endpoint", () => {
      const { binder } = binderWith()

      void binder.bind("Card:title", { type: "literal", value: '"hi"' }, "app")

      expect(binder.getActiveEndpoints("Card")).toEqual([])
    })

    it("then keeps an endpoint active while another binding still reaches it", async () => {
      const { binder } = binderWith()
      const deactivated: string[] = []

      binder.endpointDeactivated.on("app", (_componentFQ, localPath) => deactivated.push(localPath))

      await binder.bind("Card:title", upperOf("name", ["Upper"]), "app")
      await binder.bind("Card:label", upperOf("name", ["Upper"]), "app")

      binder.unbind("Card:title")
      expect(deactivated).toEqual([])

      binder.unbind("Card:label")
      expect(deactivated).toEqual(["name"])
    })

    it("then reports endpoints already live to a component built after them", async () => {
      const { binder } = binderWith()

      await binder.bind("Card:title", upperOf("name", ["Upper"]), "app")
      expect(binder.getActiveEndpoints("Card")).toEqual(["title"])

      binder.unbind("Card:title")
      expect(binder.getActiveEndpoints("Card")).toEqual([])
    })

    it("then holds an endpoint through a rebind, across the async resolve of the new parameters", async () => {
      const { binder } = binderWith()
      const events: string[] = []

      binder.endpointActivated.on("Input", (_componentFQ, localPath) => events.push(`+${localPath}`))
      binder.endpointDeactivated.on("Input", (_componentFQ, localPath) => events.push(`-${localPath}`))

      // A dictionary source is dimension-sensitive, so a dimension switch
      // re-establishes this binding - the event must not lapse in between.
      const binding: IBindingExpression = { type: "dictionary", value: "D.hi", converters: ["Upper"] }

      await binder.bind("Input:click.type", binding, "app")
      expect(events).toEqual(["+click.type"])

      binder.rebind("Input:click.type", binding, "app")
      expect(binder.getActiveEndpoints("Input")).toEqual(["click.type"])

      await flush()
      expect(events).toEqual(["+click.type"])
      expect(binder.getActiveEndpoints("Input")).toEqual(["click.type"])
    })

    it("then releases only the endpoints a rebind leaves behind, acquiring the arrivals first", async () => {
      const { binder } = binderWith()
      const scope: string[] = []
      const target: string[] = []

      binder.endpointActivated.on("app", (_componentFQ, localPath) => scope.push(`+${localPath}`))
      binder.endpointDeactivated.on("app", (_componentFQ, localPath) => scope.push(`-${localPath}`))
      binder.endpointActivated.on("Card", (_componentFQ, localPath) => target.push(`+${localPath}`))
      binder.endpointDeactivated.on("Card", (_componentFQ, localPath) => target.push(`-${localPath}`))

      await binder.bind("Card:title", upperOf("a", ["Upper"]), "app")
      await binder.bind("Card:title", upperOf("b", ["Upper"]), "app")

      expect(scope).toEqual(["+a", "+b", "-a"])
      expect(target).toEqual(["+title"])
    })

    it("then releases the endpoints of a binding replaced by a literal", () => {
      const { binder } = binderWith()

      void binder.bind("Card:title", { type: "state", value: "name" }, "app")
      expect(binder.getActiveEndpoints("app")).toEqual(["name"])

      void binder.bind("Card:title", { type: "literal", value: '"hi"' }, "app")
      expect(binder.getActiveEndpoints("app")).toEqual([])
      expect(binder.getActiveEndpoints("Card")).toEqual([])
    })
  })
})
