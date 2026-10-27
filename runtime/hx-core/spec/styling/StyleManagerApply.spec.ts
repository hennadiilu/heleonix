import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import type {
  Component,
  IDisposable,
  IStyleDriver,
  IStyleEffect,
  IStyleRule,
  IStyleVariable,
  StyleCondition,
} from "@heleonix/hx-core"
import { StyleQualifier, styleVariableName } from "@heleonix/hx-core"
import type { IBindingValueSource } from "../../src/bindings/IBindingValueSource"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IQualifierUsage, IStyleDefinition } from "@heleonix/hx-language"
import { FakeState, asComponent, cmp, componentTree, entrySource, managerWith } from "./styleManagerFakes"

const raw = (source: string): string => styleVariableName(source, false)

const text = (source: string): string => styleVariableName(source, true)

class FakeEffect implements IStyleEffect {
  public readonly classesSet: string[] = []
  public readonly classesRemoved: string[] = []
  public readonly variables: [string, string][] = []
  public readonly variablesRemoved: string[] = []
  public readonly current = new Map<string, string>()

  public setAttribute(): void {}
  public removeAttribute(): void {}
  public setVariable(variable: IStyleVariable, value: string): void {
    this.variables.push([variable.name, value])
    this.current.set(variable.name, value)
  }
  public removeVariable(variable: IStyleVariable): void {
    this.variablesRemoved.push(variable.name)
    this.current.delete(variable.name)
  }
  public addClass(id: string): void {
    this.classesSet.push(id)
  }
  public removeClass(id: string): void {
    this.classesRemoved.push(id)
  }
  public setProperty(): void {}
  public removeProperty(): void {}
}

class FakeDriver implements IStyleDriver {
  public readonly rules: IStyleRule[] = []
  public readonly keyframes: string[] = []
  public readonly removed: string[] = []
  public readonly effects = new Map<string, FakeEffect>()

  public insertRule(rule: IStyleRule): void {
    this.rules.push(rule)
  }

  public insertKeyframes(id: string): void {
    this.keyframes.push(id)
  }

  public remove(id: string): void {
    this.removed.push(id)
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
    it("then inserts one rule per signature and adds its class to the component", async () => {
      const driver = new FakeDriver()

      await managerWith({ driver }).applyDefinition(cmp("A"), def({ "": { color: "red" }, Hover: { padding: "4px" } }))

      expect(driver.rules.map((rule) => rule.declarations)).toEqual([{ color: "red" }, { padding: "4px" }])
      expect(driver.effects.get("A")!.classesSet).toEqual(driver.rules.map((rule) => rule.id))
    })

    it("then names a rule by its compose input, stable across runs and a valid identifier", async () => {
      const first = new FakeDriver()
      const second = new FakeDriver()
      const style = def({ "": { color: "red" } })

      await managerWith({ driver: first }).applyDefinition(cmp("A"), style)
      await managerWith({ driver: second }).applyDefinition(cmp("A"), style)

      expect(first.rules[0].id).toMatch(/^hx-[0-9a-z]+$/)
      expect(second.rules[0].id).toBe(first.rules[0].id)
    })

    it("then subscribes to each {prop} and pushes its value through the effect", async () => {
      const driver = new FakeDriver()
      const state = new FakeState()
      state.values["A:someProp"] = 5

      await managerWith({ driver, state }).applyDefinition(cmp("A"), def({ "": { "box-shadow": "10px {someProp}px" } }))
      const effect = driver.effects.get("A")!

      expect(effect.variables).toEqual([["hx--some-prop", "5"]])

      state.setValue("A:someProp", 8)
      expect(effect.variables).toEqual([
        ["hx--some-prop", "5"],
        ["hx--some-prop", "8"],
      ])
    })
  })

  describe("refcount", () => {
    it("then shares one inserted rule across components and removes it only when the last drops it", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const shared = def({ "": { color: "red" } })

      await manager.applyDefinition(cmp("A"), shared)
      await manager.applyDefinition(cmp("B"), shared)
      expect(driver.rules.length).toBe(1)

      manager.remove(cmp("A"))
      expect(driver.removed).toEqual([])

      manager.remove(cmp("B"))
      expect(driver.removed).toEqual([driver.rules[0].id])
    })

    it("then does not share across components whose same-signature rule differs", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      await manager.applyDefinition(cmp("A"), def({ "": { color: "red" } }))
      await manager.applyDefinition(cmp("B"), def({ "": { color: "blue" } }))

      expect(driver.rules.length).toBe(2)
      expect(driver.rules[0].id).not.toBe(driver.rules[1].id)
    })

    it("then shares one rule between signatures whose compose input is identical", async () => {
      const driver = new FakeDriver()
      const root = componentTree("A")
      const menu = componentTree("Menu", "menu", root)
      const scoped = stringifyRuleKey([{ name: "Style", args: { for: "menu" } }])

      await managerWith({ driver }).applyDefinition(
        asComponent(root),
        def({ "": { color: "red" }, [scoped]: { color: "red" } }),
      )

      expect(driver.rules.length).toBe(1)
      expect(driver.effects.get(root.fqName)!.classesSet).toEqual([driver.rules[0].id])
      expect(driver.effects.get(menu.fqName)!.classesSet).toEqual([driver.rules[0].id])
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

      expect(effect.classesRemoved).toEqual(effect.classesSet)
      expect(effect.variablesRemoved).toEqual(["hx--p"])
      expect(state.subscriberCount("A:p")).toBe(0)
    })
  })

  describe("attach", () => {
    it("then runs a qualifier's attach on apply and disposes it on remove", async () => {
      let attached = 0
      let disposed = 0

      class CountingQualifier extends StyleQualifier {
        public override attach(): IDisposable {
          attached += 1

          return {
            dispose: () => {
              disposed += 1
            },
          }
        }
      }

      const qualifiers = new QualifierProvider(new Map([["If", new CountingQualifier()]]))

      const manager = managerWith({ driver: new FakeDriver(), qualifiers })

      await manager.applyDefinition(cmp("A"), def({ "If(value:{x})": { color: "red" } }))
      expect(attached).toBe(1)

      manager.remove(cmp("A"))
      expect(disposed).toBe(1)
    })
  })

  describe("conditions", () => {
    class HoverQualifier extends StyleQualifier {
      public override build(): StyleCondition {
        return { pseudo: "Hover" }
      }
    }

    class MediaQualifier extends StyleQualifier {
      public override build(usage: IQualifierUsage): StyleCondition {
        return { environment: usage.args["query"] }
      }
    }

    class AttachOnlyQualifier extends StyleQualifier {
      public override attach(): IDisposable {
        return { dispose() {} }
      }
    }

    const qualifiers = new QualifierProvider(
      new Map<string, StyleQualifier>([
        ["Hover", new HoverQualifier()],
        ["Media", new MediaQualifier()],
        ["If", new AttachOnlyQualifier()],
      ]),
    )

    async function composedConditions(signature: string): Promise<readonly StyleCondition[]> {
      const driver = new FakeDriver()

      await managerWith({ driver, qualifiers }).applyDefinition(cmp("A"), def({ [signature]: { color: "red" } }))

      return driver.rules[0].conditions
    }

    it("then dispatches each `&`-segment to its qualifier's build", async () => {
      expect(await composedConditions("Hover&Media(query:(max-width:600px))")).toEqual([
        { pseudo: "Hover" },
        { environment: "(max-width:600px)" },
      ])
    })

    it("then skips attach-only and unregistered qualifiers", async () => {
      expect(await composedConditions("If(value:{x})")).toEqual([])
      expect(await composedConditions("If(value:{x})&Hover")).toEqual([{ pseudo: "Hover" }])
      expect(await composedConditions("Unknown")).toEqual([])
    })

    it("then yields no conditions for the root rule", async () => {
      expect(await composedConditions("")).toEqual([])
    })

    it("then never passes the scope qualifier through as a condition", async () => {
      const driver = new FakeDriver()
      const scoped = stringifyRuleKey([
        { name: "Style", args: { for: "menu" } },
        { name: "Hover", args: {} },
      ])

      const root = componentTree("A")
      componentTree("Menu", "menu", root)

      await managerWith({ driver, qualifiers }).applyDefinition(asComponent(root), def({ [scoped]: { color: "red" } }))

      expect(driver.rules[0].conditions).toEqual([{ pseudo: "Hover" }])
    })
  })

  describe("keyframes", () => {
    const animated: IStyleDefinition = {
      name: "Button",
      dimension: {},
      rules: { "": { "animation-name": "pulse" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    }

    it("then inserts each local keyframe under a style-scoped id and points animation references at it", async () => {
      const driver = new FakeDriver()

      await managerWith({ driver }).applyDefinition(cmp("A"), animated)

      expect(driver.keyframes).toEqual([jasmine.stringMatching(/^hx-Button-pulse-[0-9a-z]+$/)])
      expect(driver.rules[0].declarations).toEqual({ "animation-name": driver.keyframes[0] })
    })

    it("then rewrites only local names, in both animation properties, leaving others to the theme", async () => {
      const driver = new FakeDriver()

      await managerWith({ driver }).applyDefinition(cmp("A"), {
        ...animated,
        rules: { "": { animation: "pulse 1s, spin 2s", "animation-name": "spin, pulse", content: "'pulse'" } },
      })

      const [id] = driver.keyframes

      expect(driver.rules[0].declarations).toEqual({
        animation: `${id} 1s, spin 2s`,
        "animation-name": `spin, ${id}`,
        content: "'pulse'",
      })
    })

    it("then gives retuned frames a timeline of their own", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      await manager.applyDefinition(cmp("A"), animated)
      await manager.applyDefinition(cmp("B"), { ...animated, keyframes: { pulse: { "50%": { opacity: "0" } } } })

      expect(driver.keyframes.length).toBe(2)
      expect(driver.keyframes[0]).not.toBe(driver.keyframes[1])
      expect(driver.rules.map((rule) => rule.declarations["animation-name"])).toEqual(driver.keyframes)
    })

    it("then shares a keyframe across instances and removes it only when the last drops it", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })

      await manager.applyDefinition(cmp("A"), animated)
      await manager.applyDefinition(cmp("B"), animated)
      expect(driver.keyframes.length).toBe(1)

      manager.remove(cmp("A"))
      expect(driver.removed).not.toContain(driver.keyframes[0])

      manager.remove(cmp("B"))
      expect(driver.removed.filter((id) => id === driver.keyframes[0]).length).toBe(1)
    })

    it("then still scopes animation references on a platform without keyframes", async () => {
      const rules: IStyleRule[] = []
      const driver: IStyleDriver = {
        insertRule: (rule) => {
          rules.push(rule)
        },
        remove: () => {},
        effectFor: () => new FakeEffect(),
      }

      await managerWith({ driver }).applyDefinition(cmp("A"), animated)

      expect(rules[0].declarations["animation-name"]).toMatch(/^hx-Button-pulse-[0-9a-z]+$/)
    })
  })

  describe("re-apply", () => {
    it("then removes the previous styling first (idempotent), how a dimension change re-styles", async () => {
      const driver = new FakeDriver()
      const manager = managerWith({ driver })
      const same = def({ "": { color: "red" } })

      await manager.applyDefinition(cmp("A"), same)
      await manager.applyDefinition(cmp("A"), same)

      expect(driver.rules.length).toBe(2)
      expect(driver.removed).toEqual([driver.rules[0].id])
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

      expect(driver.effects.get(menu.fqName)!.variables).toEqual([["hx--w", "3"]])
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

      expect(driver.rules).toEqual([])
    })
  })
  describe("declaration variables", () => {
    const labels = entrySource("dictionary", { "Labels.title": "Title", "Labels.greeting": "Hi {name}" })
    const layout = entrySource("config", { "Layout.gap": "8px" })

    async function applied(
      declarations: Record<string, string>,
      state = new FakeState(),
      sources: IBindingValueSource[] = [labels, layout],
    ): Promise<{ effect: FakeEffect; state: FakeState; manager: ReturnType<typeof managerWith> }> {
      const driver = new FakeDriver()
      const manager = managerWith({ driver, state, sources })

      await manager.applyDefinition(cmp("A"), def({ "": declarations }))

      return { effect: driver.effects.get("A")!, state, manager }
    }

    it("then delivers unquoted dictionary and config sources as raw per-instance variables", async () => {
      const { effect } = await applied({ gap: "{#Layout.gap}", width: "{@Labels.title}" })

      expect(effect.current.get(raw("#Layout.gap"))).toBe("8px")
      expect(effect.current.get(raw("@Labels.title"))).toBe("Title")
    })

    it("then delivers a source inside a quoted string as a text variable", async () => {
      const { effect } = await applied({ content: "'Prefix {@Labels.title}'" })

      expect(effect.current.get(text("@Labels.title"))).toBe("Title")
      expect(effect.current.has(raw("@Labels.title"))).toBeFalse()
    })

    it("then binds the raw and text forms of one source separately", async () => {
      const { effect } = await applied({ content: "'{@Labels.title}'", width: "{@Labels.title}" })

      expect([...effect.current.keys()].sort()).toEqual([raw("@Labels.title"), text("@Labels.title")].sort())
    })

    it("then leaves an unquoted theme token to the theme but delivers a quoted one as text", async () => {
      const { effect } = await applied({ color: "{$Colors.primary}", "font-family": "'{$Fonts.main}'" })

      expect(effect.current.has(raw("$Colors.primary"))).toBeFalse()
      expect(effect.current.has(text("$Fonts.main"))).toBeTrue()
    })

    it("then re-pushes when a property a dictionary entry interpolates changes", async () => {
      const state = new FakeState()
      state.values["A:name"] = "Ann"

      const { effect } = await applied({ content: "'{@Labels.greeting}'" }, state)
      expect(effect.current.get(text("@Labels.greeting"))).toBe("Hi Ann")

      state.setValue("A:name", "Bob")
      await new Promise((r) => setTimeout(r, 0))

      expect(effect.current.get(text("@Labels.greeting"))).toBe("Hi Bob")
    })

    it("then delivers an unset source as an empty value, never the text 'undefined'", async () => {
      const { effect } = await applied({ content: "'{missing}'" })

      expect(effect.current.get(text("missing"))).toBe("")
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
      const slow: IBindingValueSource = { type: "config", get: () => gate.then(() => "8px") }
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
      const slow: IBindingValueSource = {
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

      expect(driver.effects.get("A")!.current.get(text("@Labels.x"))).toBe("second")
    })
  })
})
