import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import type {
  Component,
  IKeyframeScope,
  IStyleDriver,
  IStyleEffect,
  IStyleQualifier,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { FakeState, cmp, managerWith } from "./styleManagerFakes"

class FakeEffect implements IStyleEffect {
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

class FakeDriver implements IStyleDriver {
  public readonly composed: string[] = []
  public readonly fragments: (readonly StyleFragment[])[] = []
  public readonly scopes: (IKeyframeScope | undefined)[] = []
  public readonly keyframes: string[] = []
  public readonly released: StyleHandle[] = []
  public readonly effects = new Map<string, FakeEffect>()

  public compose(
    signature: string,
    fragments: readonly StyleFragment[],
    _declarations: Record<string, string>,
    keyframeScope?: IKeyframeScope,
  ): StyleHandle {
    this.composed.push(signature)
    this.fragments.push(fragments)
    this.scopes.push(keyframeScope)

    return { signature } as unknown as StyleHandle
  }

  public composeKeyframe(scope: string, name: string): StyleHandle {
    this.keyframes.push(`${scope}/${name}`)

    return { keyframe: `${scope}/${name}` } as unknown as StyleHandle
  }

  public release(handle: StyleHandle): void {
    this.released.push(handle)
  }

  public effectFor(component: Component): FakeEffect {
    const key = component.fqName
    let effect = this.effects.get(key)

    if (!effect) {
      effect = new FakeEffect()
      this.effects.set(key, effect)
    }

    return effect
  }
}

function def(rules: IStyleDefinition["rules"]): IStyleDefinition {
  return { name: "X", dimension: {}, rules }
}

describe("StyleManager.applyDefinition", () => {
  describe("apply", () => {
    it("then composes one artifact per signature and sets its class on the component", () => {
      const driver = new FakeDriver()

      managerWith({ driver }).applyDefinition(cmp("A"), def({ "": { color: "red" }, Hover: { padding: "4px" } }))

      expect(driver.composed).toEqual(["", "Hover"])
      expect(driver.effects.get("A")!.classesSet.length).toBe(2)
    })

    it("then subscribes to each {prop} and pushes its value through the effect", () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:someProp"] = 5

      managerWith({ driver, state }).applyDefinition(cmp("A"), def({ "": { "box-shadow": "10px {someProp}px" } }))
      const effect = driver.effects.get("A")!

      expect(effect.variables).toEqual([["someProp", "5"]])

      state.setValue("A:someProp", 8)
      expect(effect.variables).toEqual([
        ["someProp", "5"],
        ["someProp", "8"],
      ])
    })
  })

  describe("refcount", () => {
    it("then shares one composed artifact across components and releases it only when the last drops it", () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const shared = def({ "": { color: "red" } })

      manager.applyDefinition(cmp("A"), shared)
      manager.applyDefinition(cmp("B"), shared)
      expect(driver.composed).toEqual([""])

      manager.remove(cmp("A"))
      expect(driver.released).toEqual([])

      manager.remove(cmp("B"))
      expect(driver.released.length).toBe(1)
    })

    it("then does not share across components whose same-signature rule differs", () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      manager.applyDefinition(cmp("A"), def({ "": { color: "red" } }))
      manager.applyDefinition(cmp("B"), def({ "": { color: "blue" } }))

      expect(driver.composed).toEqual(["", ""])
    })
  })

  describe("remove", () => {
    it("then removes the class/variables and unsubscribes symmetrically", () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:p"] = 1
      const manager = managerWith({ driver, state })

      manager.applyDefinition(cmp("A"), def({ "": { width: "{p}px" } }))
      expect(state.subscriberCount("A:p")).toBe(1)

      manager.remove(cmp("A"))
      const effect = driver.effects.get("A")!

      expect(effect.classesRemoved.length).toBe(1)
      expect(effect.variablesRemoved).toEqual(["p"])
      expect(state.subscriberCount("A:p")).toBe(0)
    })
  })

  describe("attach", () => {
    it("then runs a qualifier's attach on apply and disposes it on remove", () => {
      let attached = 0
      let disposed = 0
      const qualifiers = new QualifierProvider(
        new Map<string, IStyleQualifier>([
          [
            "If",
            {
              attach: () => {
                attached += 1

                return {
                  dispose: () => {
                    disposed += 1
                  },
                }
              },
            },
          ],
        ]),
      )

      const manager = managerWith({ driver: new FakeDriver(), qualifiers })

      manager.applyDefinition(cmp("A"), def({ "If(value:{x})": { color: "red" } }))
      expect(attached).toBe(1)

      manager.remove(cmp("A"))
      expect(disposed).toBe(1)
    })
  })

  describe("fragments", () => {
    const hover: IStyleQualifier = { build: () => ({ pseudo: "Hover" }) }
    const media: IStyleQualifier = { build: (usage) => ({ environment: usage.args["query"] }) }
    const iff: IStyleQualifier = { attach: () => ({ dispose() {} }) }
    const qualifiers = new QualifierProvider(
      new Map<string, IStyleQualifier>([
        ["Hover", hover],
        ["Media", media],
        ["If", iff],
      ]),
    )

    function composedFragments(signature: string): readonly StyleFragment[] {
      const driver = new FakeDriver()

      managerWith({ driver, qualifiers }).applyDefinition(cmp("A"), def({ [signature]: { color: "red" } }))

      return driver.fragments[0]
    }

    it("then dispatches each `&`-segment to its qualifier's build", () => {
      expect(composedFragments("Hover&Media(query:(max-width:600px))")).toEqual([
        { pseudo: "Hover" },
        { environment: "(max-width:600px)" },
      ])
    })

    it("then skips attach-only and unregistered qualifiers", () => {
      expect(composedFragments("If(value:{x})")).toEqual([])
      expect(composedFragments("If(value:{x})&Hover")).toEqual([{ pseudo: "Hover" }])
      expect(composedFragments("Unknown")).toEqual([])
    })

    it("then yields no fragments for the root rule", () => {
      expect(composedFragments("")).toEqual([])
    })

    it("then never passes the scope qualifier through as a fragment", () => {
      const driver = new FakeDriver()
      const scoped = stringifyRuleKey([
        { name: "Style", args: { for: "menu" } },
        { name: "Hover", args: {} },
      ])

      managerWith({
        driver,
        qualifiers,
        scope: { resolve: () => [cmp("child")] },
      }).applyDefinition(cmp("A"), def({ [scoped]: { color: "red" } }))

      expect(driver.fragments[0]).toEqual([{ pseudo: "Hover" }])
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
      const driver = new FakeDriver()

      managerWith({ driver }).applyDefinition(cmp("A"), animated)

      expect(driver.keyframes).toEqual(["Button/pulse"])
      expect(driver.scopes).toEqual([{ scope: "Button", names: ["pulse"] }])
    })

    it("then shares a keyframe across instances and releases it only when the last drops it", () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      manager.applyDefinition(cmp("A"), animated)
      manager.applyDefinition(cmp("B"), animated)
      expect(driver.keyframes).toEqual(["Button/pulse"])

      manager.remove(cmp("A"))
      manager.remove(cmp("B"))
      expect(driver.released.filter((h) => "keyframe" in (h as object)).length).toBe(1)
    })
  })

  describe("re-apply", () => {
    it("then removes the previous styling first (idempotent), how a dimension change re-styles", () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const same = def({ "": { color: "red" } })

      manager.applyDefinition(cmp("A"), same)
      manager.applyDefinition(cmp("A"), same)

      expect(driver.composed).toEqual(["", ""])
      expect(driver.released.length).toBe(1)
    })
  })

  describe("scope (@hx-style(for:))", () => {
    const scopeKey = stringifyRuleKey([{ name: "Style", args: { for: "menu" } }])
    const toChild = { resolve: (_component: Component, path: string) => (path === "menu" ? [cmp("child")] : []) }

    it("then applies a scoped rule's class to the resolved targets, not the styling component", () => {
      const driver = new FakeDriver()

      managerWith({ driver, scope: toChild }).applyDefinition(cmp("A"), def({ [scopeKey]: { color: "red" } }))

      expect(driver.effects.get("A")!.classesSet.length).toBe(0)
      expect(driver.effects.get("child")!.classesSet.length).toBe(1)
    })

    it("then sets a scoped rule's {prop} variable on the target, not the styling component", () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:w"] = 3

      managerWith({ driver, state, scope: toChild }).applyDefinition(cmp("A"), def({ [scopeKey]: { width: "{w}px" } }))

      expect(driver.effects.get("child")!.variables).toEqual([["w", "3"]])
      expect(driver.effects.get("A")!.variables).toEqual([])
    })

    it("then tears down scoped classes from the target on remove", () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver, scope: toChild })

      manager.applyDefinition(cmp("A"), def({ [scopeKey]: { color: "red" } }))
      manager.remove(cmp("A"))

      expect(driver.effects.get("child")!.classesRemoved.length).toBe(1)
    })

    it("then skips a scoped rule that resolves to no targets", () => {
      const driver = new FakeDriver()

      managerWith({ driver, scope: { resolve: () => [] } }).applyDefinition(
        cmp("A"),
        def({ [scopeKey]: { color: "red" } }),
      )

      expect(driver.composed).toEqual([])
    })
  })
})
