import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import type {
  Component,
  IKeyframeScope,
  IStyleDriver,
  IStyleEffect,
  IStyleQualifier,
  IStyleVariable,
  IValueSource,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { FakeState, asComponent, cmp, componentTree, entrySource, managerWith } from "./styleManagerFakes"

class FakeEffect implements IStyleEffect {
  public readonly classesSet: StyleHandle[] = []
  public readonly classesRemoved: StyleHandle[] = []
  public readonly variables: [string, string][] = []
  public readonly variablesRemoved: string[] = []
  public readonly current = new Map<string, string>()

  public setAttribute(): void {}
  public removeAttribute(): void {}
  public setVariable(variable: IStyleVariable, value: string): void {
    this.variables.push([variable.source, value])
    this.current.set(`${variable.text ? "text" : "raw"} ${variable.source}`, value)
  }
  public removeVariable(variable: IStyleVariable): void {
    this.variablesRemoved.push(variable.source)
    this.current.delete(`${variable.text ? "text" : "raw"} ${variable.source}`)
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
    it("then composes one artifact per signature and sets its class on the component", async () => {
      const driver = new FakeDriver()

      await managerWith({ driver }).applyDefinition(cmp("A"), def({ "": { color: "red" }, Hover: { padding: "4px" } }))

      expect(driver.composed).toEqual(["", "Hover"])
      expect(driver.effects.get("A")!.classesSet.length).toBe(2)
    })

    it("then subscribes to each {prop} and pushes its value through the effect", async () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:someProp"] = 5

      await managerWith({ driver, state }).applyDefinition(cmp("A"), def({ "": { "box-shadow": "10px {someProp}px" } }))
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
    it("then shares one composed artifact across components and releases it only when the last drops it", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const shared = def({ "": { color: "red" } })

      await manager.applyDefinition(cmp("A"), shared)
      await manager.applyDefinition(cmp("B"), shared)
      expect(driver.composed).toEqual([""])

      manager.remove(cmp("A"))
      expect(driver.released).toEqual([])

      manager.remove(cmp("B"))
      expect(driver.released.length).toBe(1)
    })

    it("then does not share across components whose same-signature rule differs", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      await manager.applyDefinition(cmp("A"), def({ "": { color: "red" } }))
      await manager.applyDefinition(cmp("B"), def({ "": { color: "blue" } }))

      expect(driver.composed).toEqual(["", ""])
    })
  })

  describe("remove", () => {
    it("then removes the class/variables and unsubscribes symmetrically", async () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:p"] = 1
      const manager = managerWith({ driver, state })

      await manager.applyDefinition(cmp("A"), def({ "": { width: "{p}px" } }))
      expect(state.subscriberCount("A:p")).toBe(1)

      manager.remove(cmp("A"))
      const effect = driver.effects.get("A")!

      expect(effect.classesRemoved.length).toBe(1)
      expect(effect.variablesRemoved).toEqual(["p"])
      expect(state.subscriberCount("A:p")).toBe(0)
    })
  })

  describe("attach", () => {
    it("then runs a qualifier's attach on apply and disposes it on remove", async () => {
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

      await manager.applyDefinition(cmp("A"), def({ "If(value:{x})": { color: "red" } }))
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

    async function composedFragments(signature: string): Promise<readonly StyleFragment[]> {
      const driver = new FakeDriver()

      await managerWith({ driver, qualifiers }).applyDefinition(cmp("A"), def({ [signature]: { color: "red" } }))

      return driver.fragments[0]
    }

    it("then dispatches each `&`-segment to its qualifier's build", async () => {
      expect(await composedFragments("Hover&Media(query:(max-width:600px))")).toEqual([
        { pseudo: "Hover" },
        { environment: "(max-width:600px)" },
      ])
    })

    it("then skips attach-only and unregistered qualifiers", async () => {
      expect(await composedFragments("If(value:{x})")).toEqual([])
      expect(await composedFragments("If(value:{x})&Hover")).toEqual([{ pseudo: "Hover" }])
      expect(await composedFragments("Unknown")).toEqual([])
    })

    it("then yields no fragments for the root rule", async () => {
      expect(await composedFragments("")).toEqual([])
    })

    it("then never passes the scope qualifier through as a fragment", async () => {
      const driver = new FakeDriver()
      const scoped = stringifyRuleKey([
        { name: "Style", args: { for: "menu" } },
        { name: "Hover", args: {} },
      ])

      const root = componentTree("A")
      componentTree("Menu", "menu", root)

      await managerWith({ driver, qualifiers }).applyDefinition(asComponent(root), def({ [scoped]: { color: "red" } }))

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

    it("then emits each local keyframe and forwards the scope to every rule's compose", async () => {
      const driver = new FakeDriver()

      await managerWith({ driver }).applyDefinition(cmp("A"), animated)

      expect(driver.keyframes).toEqual(["Button/pulse"])
      expect(driver.scopes).toEqual([{ scope: "Button", names: ["pulse"] }])
    })

    it("then shares a keyframe across instances and releases it only when the last drops it", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      await manager.applyDefinition(cmp("A"), animated)
      await manager.applyDefinition(cmp("B"), animated)
      expect(driver.keyframes).toEqual(["Button/pulse"])

      manager.remove(cmp("A"))
      manager.remove(cmp("B"))
      expect(driver.released.filter((h) => "keyframe" in (h as object)).length).toBe(1)
    })
  })

  describe("re-apply", () => {
    it("then removes the previous styling first (idempotent), how a dimension change re-styles", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const same = def({ "": { color: "red" } })

      await manager.applyDefinition(cmp("A"), same)
      await manager.applyDefinition(cmp("A"), same)

      expect(driver.composed).toEqual(["", ""])
      expect(driver.released.length).toBe(1)
    })
  })

  describe("scope (@hx-style(for:))", () => {
    function scoped(path: string, declarations: Record<string, string> = { color: "red" }): IStyleDefinition {
      return def({ [stringifyRuleKey([{ name: "Style", args: { for: path } }])]: declarations })
    }

    it("then applies a scoped rule's class to the resolved targets, not the styling component", async () => {
      const driver = new FakeDriver()
      const root = componentTree("A")
      const menu = componentTree("Menu", "menu", root)

      await managerWith({ driver }).applyDefinition(asComponent(root), scoped("menu"))

      expect(driver.effects.get(root.fqName)!.classesSet.length).toBe(0)
      expect(driver.effects.get(menu.fqName)!.classesSet.length).toBe(1)
    })

    it("then resolves a nested control path, searching through anonymous wrappers", async () => {
      const driver = new FakeDriver()
      const root = componentTree("A")
      const head = componentTree("Head", "head", componentTree("Wrapper", undefined, root))
      const item = componentTree("Item", "item", componentTree("Menu", "menu", componentTree("Div", undefined, head)))

      await managerWith({ driver }).applyDefinition(asComponent(root), scoped("head.menu.item"))

      expect(driver.effects.get(item.fqName)!.classesSet.length).toBe(1)
    })

    it("then targets every match of the final segment (a repeated control name)", async () => {
      const driver = new FakeDriver()
      const root = componentTree("A")
      const list = componentTree("List", "list", root)
      const first = componentTree("First", "item", list)
      const second = componentTree("Second", "item", list)

      await managerWith({ driver }).applyDefinition(asComponent(root), scoped("list.item"))

      expect(driver.effects.get(first.fqName)!.classesSet.length).toBe(1)
      expect(driver.effects.get(second.fqName)!.classesSet.length).toBe(1)
    })

    it("then sets a scoped rule's {prop} variable on the target, not the styling component", async () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      const root = componentTree("A")
      const menu = componentTree("Menu", "menu", root)
      state.values["A:w"] = 3

      await managerWith({ driver, state }).applyDefinition(asComponent(root), scoped("menu", { width: "{w}px" }))

      expect(driver.effects.get(menu.fqName)!.variables).toEqual([["w", "3"]])
      expect(driver.effects.get(root.fqName)!.variables).toEqual([])
    })

    it("then tears down scoped classes from the target on remove", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const root = componentTree("A")
      const menu = componentTree("Menu", "menu", root)

      await manager.applyDefinition(asComponent(root), scoped("menu"))
      manager.remove(asComponent(root))

      expect(driver.effects.get(menu.fqName)!.classesRemoved.length).toBe(1)
    })

    it("then skips a scoped rule whose path resolves to no targets", async () => {
      const driver = new FakeDriver()
      const root = componentTree("A")
      componentTree("Head", "head", root)

      await managerWith({ driver }).applyDefinition(asComponent(root), scoped("head.nope"))

      expect(driver.composed).toEqual([])
    })
  })
  describe("declaration variables", () => {
    const labels = entrySource("dictionary", { "Labels.title": "Title", "Labels.greeting": "Hi {name}" })
    const layout = entrySource("config", { "Layout.gap": "8px" })

    async function applied(
      declarations: Record<string, string>,
      state = new FakeState(),
      sources: IValueSource[] = [labels, layout],
    ): Promise<{ effect: FakeEffect; state: FakeState; manager: ReturnType<typeof managerWith> }> {
      const driver = new FakeDriver()
      const manager = managerWith({ driver, state, sources })

      await manager.applyDefinition(cmp("A"), def({ "": declarations }))

      return { effect: driver.effects.get("A")!, state, manager }
    }

    it("then delivers unquoted dictionary and config sources as raw per-instance variables", async () => {
      const { effect } = await applied({ gap: "{#Layout.gap}", width: "{@Labels.title}" })

      expect(effect.current.get("raw #Layout.gap")).toBe("8px")
      expect(effect.current.get("raw @Labels.title")).toBe("Title")
    })

    it("then delivers a source inside a quoted string as a text variable", async () => {
      const { effect } = await applied({ content: "'Prefix {@Labels.title}'" })

      expect(effect.current.get("text @Labels.title")).toBe("Title")
      expect(effect.current.has("raw @Labels.title")).toBeFalse()
    })

    it("then binds the raw and text forms of one source separately", async () => {
      const { effect } = await applied({ content: "'{@Labels.title}'", width: "{@Labels.title}" })

      expect([...effect.current.keys()].sort()).toEqual(["raw @Labels.title", "text @Labels.title"])
    })

    it("then leaves an unquoted theme token to the theme but delivers a quoted one as text", async () => {
      const { effect } = await applied({ color: "{$Colors.primary}", "font-family": "'{$Fonts.main}'" })

      expect(effect.current.has("raw $Colors.primary")).toBeFalse()
      expect(effect.current.has("text $Fonts.main")).toBeTrue()
    })

    it("then re-pushes when a property a dictionary entry interpolates changes", async () => {
      const state = new FakeState()
      state.values["A:name"] = "Ann"

      const { effect } = await applied({ content: "'{@Labels.greeting}'" }, state)
      expect(effect.current.get("text @Labels.greeting")).toBe("Hi Ann")

      state.setValue("A:name", "Bob")
      await new Promise((r) => setTimeout(r, 0))

      expect(effect.current.get("text @Labels.greeting")).toBe("Hi Bob")
    })

    it("then delivers an unset source as an empty value, never the text 'undefined'", async () => {
      const { effect } = await applied({ content: "'{missing}'" })

      expect(effect.current.get("text missing")).toBe("")
    })

    it("then removes every variable it set when the styling is removed", async () => {
      const { effect, manager, state } = await applied({ gap: "{#Layout.gap}", content: "'{name}'" })

      manager.remove(cmp("A"))

      expect(effect.current.size).toBe(0)
      expect(state.subscriberCount("A:name")).toBe(0)
    })

    it("then writes nothing for a resolve that settles after the styling was removed", async () => {
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      const slow: IValueSource = { type: "config", get: () => gate.then(() => "8px") }
      const driver = new FakeDriver()
      const manager = managerWith({ driver, sources: [slow] })

      const applying = manager.applyDefinition(cmp("A"), def({ "": { gap: "{#Layout.gap}" } }))
      await new Promise((r) => setTimeout(r, 0))
      manager.remove(cmp("A"))
      release()
      await applying

      expect(driver.effects.get("A")!.current.size).toBe(0)
    })

    it("then lets the newest value win when an older resolve settles later", async () => {
      const later: ((value: string) => void)[] = []
      let calls = 0
      const slow: IValueSource = {
        type: "dictionary",
        get: () => (++calls <= 2 ? Promise.resolve("{n}") : new Promise<string>((r) => later.push(r))),
      }
      const state = new FakeState()
      const driver = new FakeDriver()
      const manager = managerWith({ driver, state, sources: [slow] })

      await manager.applyDefinition(cmp("A"), def({ "": { content: "'{@Labels.x}'" } }))

      state.setValue("A:n", "first")
      state.setValue("A:n", "second")
      expect(later.length).toBe(2)

      later[1]("{n}")
      await new Promise((r) => setTimeout(r, 0))
      later[0]("stale")
      await new Promise((r) => setTimeout(r, 0))

      expect(driver.effects.get("A")!.current.get("text @Labels.x")).toBe("second")
    })
  })
})
