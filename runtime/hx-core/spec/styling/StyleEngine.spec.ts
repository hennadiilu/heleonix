import { StyleEngine, QualifierRegistry } from "@heleonix/hx-core"
import type {
  IKeyframeScope,
  StyleEffect,
  StyleEnginePlatform,
  StyleEngineState,
  StyleFragment,
  StyleHandle,
  StyleScopeResolver,
} from "@heleonix/hx-core"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDeclarations, IStyleDefinition } from "@heleonix/hx-language"

class FakeEffect implements StyleEffect {
  public readonly classesSet: StyleHandle[] = []
  public readonly classesRemoved: StyleHandle[] = []
  public readonly variables: [string, string][] = []
  public readonly variablesRemoved: string[] = []

  public setAttribute(): void {}
  public removeAttribute(): void {}
  public setVariable(name: string, value: string): void {
    this.variables.push([name, value])
  }
  public removeVariable(name: string): void {
    this.variablesRemoved.push(name)
  }
  public setClass(handle: StyleHandle): void {
    this.classesSet.push(handle)
  }
  public removeClass(handle: StyleHandle): void {
    this.classesRemoved.push(handle)
  }
  public setProperty(): void {}
  public removeProperty(): void {}
}

class FakePlatform implements StyleEnginePlatform<string> {
  public readonly composed: string[] = []
  public readonly scopes: (IKeyframeScope | undefined)[] = []
  public readonly keyframes: string[] = []
  public readonly released: StyleHandle[] = []
  public readonly effects = new Map<string, FakeEffect>()

  public compose(
    signature: string,
    _fragments: readonly StyleFragment[],
    _declarations: Record<string, string>,
    keyframeScope?: IKeyframeScope,
  ): StyleHandle {
    this.composed.push(signature)
    this.scopes.push(keyframeScope)

    return { signature } as unknown as StyleHandle
  }

  public composeKeyframe(scope: string, name: string, _frames: Record<string, IStyleDeclarations>): StyleHandle {
    this.keyframes.push(`${scope}/${name}`)

    return { keyframe: `${scope}/${name}` } as unknown as StyleHandle
  }

  public release(handle: StyleHandle): void {
    this.released.push(handle)
  }

  public effectFor(component: string): FakeEffect {
    let effect = this.effects.get(component)

    if (!effect) {
      effect = new FakeEffect()
      this.effects.set(component, effect)
    }

    return effect
  }
}

class FakeState implements StyleEngineState<string> {
  public values: Record<string, unknown>
  private readonly handlers = new Map<string, (() => void)[]>()

  public constructor(values: Record<string, unknown>) {
    this.values = values
  }

  public subscribe(_component: string, prop: string, handler: () => void): () => void {
    const list = this.handlers.get(prop) ?? []
    list.push(handler)
    this.handlers.set(prop, list)

    return () =>
      this.handlers.set(
        prop,
        (this.handlers.get(prop) ?? []).filter((h) => h !== handler),
      )
  }

  public getValue(_component: string, prop: string): unknown {
    return this.values[prop]
  }

  public change(prop: string, value: unknown): void {
    this.values[prop] = value

    for (const handler of [...(this.handlers.get(prop) ?? [])]) {
      handler()
    }
  }

  public subscriberCount(prop: string): number {
    return (this.handlers.get(prop) ?? []).length
  }
}

function def(rules: IStyleDefinition["rules"]): IStyleDefinition {
  return { name: "X", dimension: {}, rules }
}

function engineWith(platform: FakePlatform, state: FakeState): StyleEngine<string> {
  return new StyleEngine<string>(new QualifierRegistry(), platform, state)
}

describe("StyleEngine", () => {
  describe("apply", () => {
    it("then composes one artifact per signature and sets its class on the component", () => {
      const platform = new FakePlatform()

      engineWith(platform, new FakeState({})).apply("A", def({ "": { color: "red" }, Hover: { padding: "4px" } }))

      expect(platform.composed).toEqual(["", "Hover"])
      expect(platform.effects.get("A")!.classesSet.length).toBe(2)
    })

    it("then subscribes to each {prop} and pushes its value through the effect", () => {
      const platform = new FakePlatform()
      const state = new FakeState({ someProp: 5 })

      engineWith(platform, state).apply("A", def({ "": { "box-shadow": "10px {someProp}px" } }))
      const effect = platform.effects.get("A")!

      expect(effect.variables).toEqual([["someProp", "5"]])

      state.change("someProp", 8)
      expect(effect.variables).toEqual([
        ["someProp", "5"],
        ["someProp", "8"],
      ])
    })
  })

  describe("refcount", () => {
    it("then shares one composed artifact across components and releases it only when the last drops it", () => {
      const platform = new FakePlatform()
      const engine = engineWith(platform, new FakeState({}))
      const shared = def({ "": { color: "red" } })

      engine.apply("A", shared)
      engine.apply("B", shared)
      expect(platform.composed).toEqual([""])

      engine.remove("A")
      expect(platform.released).toEqual([])

      engine.remove("B")
      expect(platform.released.length).toBe(1)
    })

    it("then does not share across components whose same-signature rule differs", () => {
      const platform = new FakePlatform()
      const engine = engineWith(platform, new FakeState({}))

      engine.apply("A", def({ "": { color: "red" } }))
      engine.apply("B", def({ "": { color: "blue" } }))

      expect(platform.composed).toEqual(["", ""])
    })
  })

  describe("remove", () => {
    it("then removes the class/variables and unsubscribes symmetrically", () => {
      const platform = new FakePlatform()
      const state = new FakeState({ p: 1 })
      const engine = engineWith(platform, state)

      engine.apply("A", def({ "": { width: "{p}px" } }))
      expect(state.subscriberCount("p")).toBe(1)

      engine.remove("A")
      const effect = platform.effects.get("A")!

      expect(effect.classesRemoved.length).toBe(1)
      expect(effect.variablesRemoved).toEqual(["p"])
      expect(state.subscriberCount("p")).toBe(0)
    })
  })

  describe("attach", () => {
    it("then runs a qualifier's attach on apply and disposes it on remove", () => {
      const registry = new QualifierRegistry()
      let attached = 0
      let disposed = 0
      registry.register("If", {
        attach: () => {
          attached += 1

          return {
            dispose: () => {
              disposed += 1
            },
          }
        },
      })
      const engine = new StyleEngine<string>(registry, new FakePlatform(), new FakeState({}))

      engine.apply("A", def({ "If(value:{x})": { color: "red" } }))
      expect(attached).toBe(1)

      engine.remove("A")
      expect(disposed).toBe(1)
    })
  })

  describe("keyframes", () => {
    const animated: IStyleDefinition = {
      name: "Button",
      dimension: {},
      rules: { "": { "animation-name": "pulse" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    }

    it("then emits each local keyframe and forwards the scope to every rule's compose", () => {
      const platform = new FakePlatform()

      engineWith(platform, new FakeState({})).apply("A", animated)

      expect(platform.keyframes).toEqual(["Button/pulse"])
      expect(platform.scopes).toEqual([{ scope: "Button", names: ["pulse"] }])
    })

    it("then shares a keyframe across instances and releases it only when the last drops it", () => {
      const platform = new FakePlatform()
      const engine = engineWith(platform, new FakeState({}))

      engine.apply("A", animated)
      engine.apply("B", animated)
      expect(platform.keyframes).toEqual(["Button/pulse"])

      engine.remove("A")
      engine.remove("B")
      expect(platform.released.filter((h) => "keyframe" in (h as object)).length).toBe(1)
    })
  })

  describe("re-apply", () => {
    it("then removes the previous styling first (idempotent), how a dimension change re-styles", () => {
      const platform = new FakePlatform()
      const engine = engineWith(platform, new FakeState({}))
      const same = def({ "": { color: "red" } })

      engine.apply("A", same)
      engine.apply("A", same)

      expect(platform.composed).toEqual(["", ""])
      expect(platform.released.length).toBe(1)
    })
  })

  describe("scope (@hx-style(for:))", () => {
    const scopeKey = stringifyRuleKey([{ name: "Style", args: { for: "menu" } }])
    const toChild: StyleScopeResolver<string> = { resolve: (_component, path) => (path === "menu" ? ["child"] : []) }

    it("then applies a scoped rule's class to the resolved targets, not the styling component", () => {
      const platform = new FakePlatform()
      const engine = new StyleEngine<string>(new QualifierRegistry(), platform, new FakeState({}), toChild)

      engine.apply("A", def({ [scopeKey]: { color: "red" } }))

      expect(platform.effects.get("A")!.classesSet.length).toBe(0)
      expect(platform.effects.get("child")!.classesSet.length).toBe(1)
    })

    it("then sets a scoped rule's {prop} variable on the target, not the styling component", () => {
      const platform = new FakePlatform()
      const engine = new StyleEngine<string>(new QualifierRegistry(), platform, new FakeState({ w: 3 }), toChild)

      engine.apply("A", def({ [scopeKey]: { width: "{w}px" } }))

      expect(platform.effects.get("child")!.variables).toEqual([["w", "3"]])
      expect(platform.effects.get("A")!.variables).toEqual([])
    })

    it("then tears down scoped classes from the target on remove", () => {
      const platform = new FakePlatform()
      const engine = new StyleEngine<string>(new QualifierRegistry(), platform, new FakeState({}), toChild)

      engine.apply("A", def({ [scopeKey]: { color: "red" } }))
      engine.remove("A")

      expect(platform.effects.get("child")!.classesRemoved.length).toBe(1)
    })

    it("then skips a scoped rule when no resolver is configured", () => {
      const platform = new FakePlatform()

      engineWith(platform, new FakeState({})).apply("A", def({ [scopeKey]: { color: "red" } }))

      expect(platform.composed).toEqual([])
    })

    it("then skips a scoped rule that resolves to no targets", () => {
      const platform = new FakePlatform()
      const engine = new StyleEngine<string>(new QualifierRegistry(), platform, new FakeState({}), {
        resolve: () => [],
      })

      engine.apply("A", def({ [scopeKey]: { color: "red" } }))

      expect(platform.composed).toEqual([])
    })
  })
})
