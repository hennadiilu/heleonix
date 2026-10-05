import { IfQualifier, MediaQualifier, PseudoQualifier } from "@heleonix/hx-core"
import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import type { StyleManager } from "../../src/styling/StyleManager"
import type {
  Component,
  IStyleDriver,
  IStyleEffect,
  IStyleQualifier,
  IValueSource,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import { parseRuleKey, stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import {
  FakeDefinitionLoader,
  FakeState,
  FakeThemeManager,
  asComponent,
  componentTree,
  entrySource,
  managerWith,
} from "./styleManagerFakes"
import type { FakeComponent } from "./styleManagerFakes"

const SCOPE_KEY = stringifyRuleKey([{ name: "Style", args: { for: "body" } }])

class FakeEffect implements IStyleEffect {
  public readonly classesSet: StyleHandle[] = []
  public readonly classesRemoved: StyleHandle[] = []
  public readonly attrs = new Set<string>()
  public setAttribute(name: string): void {
    this.attrs.add(name)
  }
  public removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
  public setVariable(): void {}
  public removeVariable(): void {}
  public setClass(handle: StyleHandle): void {
    this.classesSet.push(handle)
  }
  public removeClass(handle: StyleHandle): void {
    this.classesRemoved.push(handle)
  }
  public setProperty(): void {}
  public removeProperty(): void {}
}

class FakeStyleDriver implements IStyleDriver {
  public readonly composed: string[] = []
  public readonly composedDecls: Record<string, string>[] = []
  public readonly environments: string[] = []
  public readonly keyframes: string[] = []
  public readonly released: StyleHandle[] = []
  public readonly effect = new FakeEffect()

  public compose(
    signature: string,
    fragments: readonly StyleFragment[],
    declarations: Readonly<Record<string, string>>,
  ): StyleHandle {
    this.composed.push(signature)
    this.composedDecls.push({ ...declarations })

    for (const fragment of fragments) {
      if ("environment" in fragment) {
        this.environments.push(fragment.environment)
      }
    }

    return { signature, fragments } as unknown as StyleHandle
  }

  public composeKeyframe(scope: string, name: string): StyleHandle {
    this.keyframes.push(`${scope}/${name}`)

    return { keyframe: `${scope}/${name}` } as unknown as StyleHandle
  }

  public release(handle: StyleHandle): void {
    this.released.push(handle)
  }

  public effectFor(): IStyleEffect {
    return this.effect
  }
}

function definitions(): Record<string, IStyleDefinition> {
  return {
    Button: { name: "Button", dimension: {}, rules: { "": { color: "red" } } },
    Applied: {
      name: "Applied",
      dimension: {},
      rules: { "": { color: "red" } },
      applies: { "": ["Typography.Heading"] },
    },
    Scoped: { name: "Scoped", dimension: {}, rules: { [SCOPE_KEY]: { color: "red" } } },
    Layered: {
      name: "Layered",
      dimension: {},
      rules: {},
      applies: { "": ["Typography.Heading", "Colors.Danger"] },
    },
    Unresolved: { name: "Unresolved", dimension: {}, rules: {}, applies: { "": ["Typography.Missing"] } },
    Animated: {
      name: "Animated",
      dimension: {},
      rules: {},
      applies: { "": ["Colors.Danger"] },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    },
  }
}

function componentOf(tag: string): Component {
  return asComponent(componentTree(tag))
}

function spyOnApplyOwn(manager: StyleManager): jasmine.Spy {
  return spyOn(manager as unknown as { applyOwn(component: Component): Promise<void> }, "applyOwn").and.resolveTo()
}

function subject(sources: IValueSource[] = []): {
  manager: StyleManager
  driver: FakeStyleDriver
  loader: FakeDefinitionLoader
  theme: FakeThemeManager
  state: FakeState
} {
  const driver = new FakeStyleDriver()
  const loader = new FakeDefinitionLoader(definitions())
  const theme = new FakeThemeManager()
  const state = new FakeState()

  theme.groups = {
    Typography: { Heading: { "font-size": "2rem", color: "blue" } },
    Colors: { Danger: { color: "red", background: "pink" } },
    Sizes: { default: "md" },
  }

  const qualifiers = new QualifierProvider(
    new Map<string, IStyleQualifier>([
      ["Media", new MediaQualifier()],
      ["If", new IfQualifier()],
    ]),
    new PseudoQualifier(),
  )

  const manager = managerWith({ driver, loader, theme, state, sources, qualifiers })

  return { manager, driver, loader, theme, state }
}

function conditional(tag: string, args: Record<string, string>): { definition: IStyleDefinition; gate: string } {
  const key = stringifyRuleKey([{ name: "If", args }])
  const fragment = new IfQualifier().build(parseRuleKey(key)[0]) as { gate: string }

  return {
    definition: { name: tag, dimension: {}, rules: { [key]: { color: "red" } } },
    gate: `data-hx-${fragment.gate}`,
  }
}

describe("StyleManager", () => {
  it("then applies a component's resolved style through the platform's style driver", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Button"))

    expect(driver.composed).toEqual([""])
    expect(driver.effect.classesSet.length).toBe(1)
  })

  it("then removes the styling on teardown", async () => {
    const { manager, driver } = subject()
    const component = componentOf("Button")

    await manager.apply(component)
    manager.remove(component)

    expect(driver.effect.classesRemoved.length).toBe(1)
  })

  it("then does nothing for a component with no style definition", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Plain"))

    expect(driver.composed).toEqual([])
  })

  it("then styles nothing for a component removed while its definition was still loading", async () => {
    const { manager, driver } = subject()
    const component = componentOf("Button")

    const applying = manager.apply(component)
    manager.remove(component)
    await applying

    expect(driver.composed).toEqual([])
  })

  describe("@hx-apply", () => {
    it("then expands groups against the theme, with explicit declarations winning", async () => {
      const { manager, driver } = subject()

      await manager.apply(componentOf("Applied"))

      expect(driver.composedDecls).toEqual([{ "font-size": "2rem", color: "red" }])
    })

    it("then re-expands against the current theme when re-applied (brand overlay switch)", async () => {
      const { manager, driver, theme } = subject()
      const component = componentOf("Applied")

      await manager.apply(component)
      expect(driver.composedDecls.at(-1)).toEqual({ "font-size": "2rem", color: "red" })

      theme.groups = { Typography: { Heading: { "font-size": "3rem", color: "blue" } } }
      await manager.apply(component)

      expect(driver.composedDecls.at(-1)).toEqual({ "font-size": "3rem", color: "red" })
    })

    it("then lets a later group override an earlier one", async () => {
      const { manager, driver } = subject()

      await manager.apply(componentOf("Layered"))

      expect(driver.composedDecls).toEqual([{ "font-size": "2rem", color: "red", background: "pink" }])
    })

    it("then contributes nothing for a path that resolves to no group", async () => {
      const { manager, driver } = subject()

      await manager.apply(componentOf("Unresolved"))

      expect(driver.composedDecls).toEqual([{}])
    })

    it("then keeps local keyframes while expanding", async () => {
      const { manager, driver } = subject()

      await manager.apply(componentOf("Animated"))

      expect(driver.composedDecls).toEqual([{ color: "red", background: "pink" }])
      expect(driver.keyframes).toEqual(["Animated/pulse"])
    })
  })

  describe("reapply (a dimension switch)", () => {
    it("then re-styles every styled component", async () => {
      const { manager, driver } = subject()

      await manager.apply(componentOf("Button"))
      expect(driver.composed).toEqual([""])

      await manager.reapply()

      expect(driver.composed).toEqual(["", ""])
    })

    it("then removes a style the new dimension no longer defines", async () => {
      const { manager, driver, loader } = subject()

      await manager.apply(componentOf("Button"))

      loader.set("Button", undefined)
      await manager.reapply()

      expect(driver.effect.classesRemoved.length).toBe(1)
    })

    it("then styles a component that gains a style only in the new dimension", async () => {
      const { manager, driver, loader } = subject()

      await manager.apply(componentOf("Plain"))
      expect(driver.composed).toEqual([])

      loader.set("Plain", { name: "Plain", dimension: {}, rules: { "": { color: "blue" } } })
      await manager.reapply()

      expect(driver.composed).toEqual([""])
    })
  })

  describe("scoped ancestors", () => {
    it("then re-styles a scoped ancestor when a descendant is built later", async () => {
      const { manager } = subject()
      const parent = componentTree("Scoped")

      await manager.apply(asComponent(parent))

      const applySpy = spyOnApplyOwn(manager)
      const child = componentTree("Child", "body", parent)

      await manager.apply(asComponent(child))

      expect(applySpy).toHaveBeenCalledWith(asComponent(child))
      expect(applySpy).toHaveBeenCalledWith(asComponent(parent))
    })

    it("then composes the ancestor's scoped rule only once the matching descendant exists", async () => {
      const { manager, driver } = subject()
      const parent = componentTree("Scoped")

      await manager.apply(asComponent(parent))
      expect(driver.composed).toEqual([])

      const child = componentTree("Child", "body", parent)
      await manager.apply(asComponent(child))

      expect(driver.composed).toContain(SCOPE_KEY)
    })

    it("then does not re-style an unscoped ancestor when a descendant is built", async () => {
      const { manager } = subject()
      const parent: FakeComponent = componentTree("Button")

      await manager.apply(asComponent(parent))

      const applySpy = spyOnApplyOwn(manager)
      const child = componentTree("Child", "body", parent)

      await manager.apply(asComponent(child))

      expect(applySpy).not.toHaveBeenCalledWith(asComponent(parent))
    })
  })

  describe("@hx-if operands, resolved relative to the component", () => {
    it("then compares against a dictionary entry", async () => {
      const { manager, driver, state } = subject([entrySource("dictionary", { "Labels.primary": "primary" })])
      const { definition, gate } = conditional("Card", { value: "{variant}", is: "{@Labels.primary}" })

      state.values["Card:variant"] = "primary"
      await manager.applyDefinition(componentOf("Card"), definition)

      expect(driver.effect.attrs.has(gate)).toBeTrue()
    })

    it("then compares against a config entry", async () => {
      const { manager, driver, state } = subject([entrySource("config", { "Layout.density": "compact" })])
      const { definition, gate } = conditional("Card", { value: "{density}", is: "{#Layout.density}" })

      state.values["Card:density"] = "compact"
      await manager.applyDefinition(componentOf("Card"), definition)

      expect(driver.effect.attrs.has(gate)).toBeTrue()
    })

    it("then compares against a theme token", async () => {
      const { manager, driver, state } = subject()
      const { definition, gate } = conditional("Card", { value: "{size}", is: "{$Sizes.default}" })

      state.values["Card:size"] = "md"
      await manager.applyDefinition(componentOf("Card"), definition)

      expect(driver.effect.attrs.has(gate)).toBeTrue()
    })

    it("then re-evaluates when a property a dictionary entry interpolates changes", async () => {
      const { manager, driver, state } = subject([entrySource("dictionary", { "Labels.current": "{selected}" })])
      const { definition, gate } = conditional("Card", { value: "{variant}", is: "{@Labels.current}" })

      state.values["Card:variant"] = "primary"
      state.values["Card:selected"] = "danger"
      await manager.applyDefinition(componentOf("Card"), definition)
      expect(driver.effect.attrs.has(gate)).toBeFalse()

      state.setValue("Card:selected", "primary")
      await new Promise((r) => setTimeout(r, 0))

      expect(driver.effect.attrs.has(gate)).toBeTrue()
    })

    it("then re-resolves a dimension-scoped operand on reapply", async () => {
      const { manager, driver, state, loader, theme } = subject()
      const { definition, gate } = conditional("Card", { value: "{size}", is: "{$Sizes.default}" })
      const component = componentOf("Card")

      loader.set("Card", definition)
      state.values["Card:size"] = "lg"
      await manager.apply(component)
      expect(driver.effect.attrs.has(gate)).toBeFalse()

      theme.groups = { Sizes: { default: "lg" } }
      await manager.reapply()

      expect(driver.effect.attrs.has(gate)).toBeTrue()
    })

    it("then drops the subscriptions of an attach that settles after the component was removed", async () => {
      const { manager, state } = subject([entrySource("dictionary", { "Labels.primary": "primary" })])
      const { definition } = conditional("Card", { value: "{variant}", is: "{@Labels.primary}" })
      const component = componentOf("Card")

      const applying = manager.applyDefinition(component, definition)
      manager.remove(component)
      await applying

      expect(state.subscriberCount("Card:variant")).toBe(0)
    })
  })
  describe("theme tokens in media queries", () => {
    function media(query: string): IStyleDefinition {
      return {
        name: "Card",
        dimension: {},
        rules: { [stringifyRuleKey([{ name: "Media", args: { query } }])]: { color: "red" } },
      }
    }

    it("then resolves a theme token into the query the driver composes", async () => {
      const { manager, driver, theme } = subject()
      theme.groups = { Breakpoints: { mobile: "600px" } }

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{$Breakpoints.mobile})"))

      expect(driver.environments).toEqual(["(max-width:600px)"])
    })

    it("then follows a theme alias to its terminal value", async () => {
      const { manager, driver, theme } = subject()
      theme.groups = { Breakpoints: { mobile: "{$Breakpoints.base}", base: "480px" } }

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{$Breakpoints.mobile})"))

      expect(driver.environments).toEqual(["(max-width:480px)"])
    })

    it("then leaves an unknown token and an alias cycle as written", async () => {
      const { manager, driver, theme } = subject()
      theme.groups = { A: { x: "{$A.y}", y: "{$A.x}" } }

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{$Nope.x}) and (min-width:{$A.x})"))

      expect(driver.environments).toEqual(["(max-width:{$Nope.x}) and (min-width:{$A.x})"])
    })

    it("then recomposes the rule when the theme changes on reapply, releasing the old one", async () => {
      const { manager, driver, theme, loader } = subject()
      theme.groups = { Breakpoints: { mobile: "600px" } }
      loader.set("Card", media("(max-width:{$Breakpoints.mobile})"))

      await manager.apply(componentOf("Card"))
      theme.groups = { Breakpoints: { mobile: "720px" } }
      await manager.reapply()

      expect(driver.environments).toEqual(["(max-width:600px)", "(max-width:720px)"])
      expect(driver.released.length).toBe(1)
    })

    it("then never hands a component a sibling's stale query when they share the rule", async () => {
      const { manager, driver, theme, loader } = subject()
      theme.groups = { Breakpoints: { mobile: "600px" } }
      loader.set("Card", media("(max-width:{$Breakpoints.mobile})"))

      await manager.apply(componentOf("Card"))
      await manager.apply(componentOf("Card"))
      theme.groups = { Breakpoints: { mobile: "720px" } }
      await manager.reapply()

      const applied = driver.effect.classesSet.slice(-2) as unknown as { fragments: { environment: string }[] }[]

      expect(applied.map((handle) => handle.fragments[0].environment)).toEqual([
        "(max-width:720px)",
        "(max-width:720px)",
      ])
    })

    it("then does not wait for the theme when no query uses a token", async () => {
      const { manager, driver, theme } = subject()
      const getTheme = spyOn(theme, "getTheme").and.callThrough()

      await manager.applyDefinition(componentOf("Card"), media("(max-width:600px)"))

      expect(getTheme).not.toHaveBeenCalled()
      expect(driver.environments).toEqual(["(max-width:600px)"])
    })

    it("then composes nothing for a component removed while the theme was loading", async () => {
      const { manager, driver, theme } = subject()
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      spyOn(theme, "getTheme").and.returnValue(
        gate.then(() => ({ name: "", dimension: {}, groups: { Breakpoints: { mobile: "600px" } } })),
      )
      const component = componentOf("Card")

      const applying = manager.applyDefinition(component, media("(max-width:{$Breakpoints.mobile})"))
      manager.remove(component)
      release()
      await applying

      expect(driver.composed).toEqual([])
    })
  })
  describe("dictionaries, configs and properties in media queries", () => {
    const layout = entrySource("config", { "Layout.mobile": "600px" })
    const labels = entrySource("dictionary", {
      "Labels.orient": "portrait",
      "Labels.query": "(max-width:{maxWidth}px)",
    })

    function media(query: string): IStyleDefinition {
      return {
        name: "Card",
        dimension: {},
        rules: { [stringifyRuleKey([{ name: "Media", args: { query } }])]: { color: "red" } },
      }
    }

    const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

    it("then resolves a config entry into the query", async () => {
      const { manager, driver } = subject([layout])

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{#Layout.mobile})"))

      expect(driver.environments).toEqual(["(max-width:600px)"])
    })

    it("then resolves a dictionary entry into the query", async () => {
      const { manager, driver } = subject([labels])

      await manager.applyDefinition(componentOf("Card"), media("(orientation:{@Labels.orient})"))

      expect(driver.environments).toEqual(["(orientation:portrait)"])
    })

    it("then resolves a component property into the query", async () => {
      const { manager, driver, state } = subject()
      state.values["Card:maxWidth"] = 600

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{maxWidth}px)"))

      expect(driver.environments).toEqual(["(max-width:600px)"])
    })

    it("then recomposes under a new class when the property changes, swapping and releasing the old one", async () => {
      const { manager, driver, state } = subject()
      state.values["Card:maxWidth"] = 600

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{maxWidth}px)"))
      const [first] = driver.effect.classesSet

      state.setValue("Card:maxWidth", 720)
      await tick()

      expect(driver.environments).toEqual(["(max-width:600px)", "(max-width:720px)"])
      expect(driver.effect.classesRemoved).toEqual([first])
      expect(driver.released).toEqual([first])
    })

    it("then follows a property a dictionary entry interpolates", async () => {
      const { manager, driver, state } = subject([labels])
      state.values["Card:maxWidth"] = 600

      await manager.applyDefinition(componentOf("Card"), media("{@Labels.query}"))
      state.setValue("Card:maxWidth", 480)
      await tick()

      expect(driver.environments).toEqual(["(max-width:600px)", "(max-width:480px)"])
    })

    it("then leaves the rule and its class untouched when the resolved query is unchanged", async () => {
      const { manager, driver, state } = subject()
      state.values["Card:maxWidth"] = 600

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{maxWidth}px)"))
      state.setValue("Card:maxWidth", 600)
      await tick()

      expect(driver.composed.length).toBe(1)
      expect(driver.effect.classesSet.length).toBe(1)
      expect(driver.effect.classesRemoved).toEqual([])
      expect(driver.released).toEqual([])
    })

    it("then shares one rule between instances whose queries resolve alike, and splits those that differ", async () => {
      const { manager, driver, state } = subject()
      state.values["a:maxWidth"] = 600
      state.values["b:maxWidth"] = 600
      state.values["c:maxWidth"] = 720

      for (const name of ["a", "b", "c"]) {
        await manager.applyDefinition(asComponent(componentTree("Card", name)), media("(max-width:{maxWidth}px)"))
      }

      expect(driver.environments).toEqual(["(max-width:600px)", "(max-width:720px)"])
    })

    it("then leaves an unset property as written, so the rule never applies", async () => {
      const { manager, driver } = subject()

      await manager.applyDefinition(componentOf("Card"), media("(max-width:{maxWidth}px)"))

      expect(driver.environments).toEqual(["(max-width:{maxWidth}px)"])
    })

    it("then stops following the property once the styling is removed", async () => {
      const { manager, driver, state } = subject()
      const component = componentOf("Card")
      state.values["Card:maxWidth"] = 600

      await manager.applyDefinition(component, media("(max-width:{maxWidth}px)"))
      manager.remove(component)
      state.setValue("Card:maxWidth", 720)
      await tick()

      expect(driver.composed.length).toBe(1)
      expect(state.subscriberCount("Card:maxWidth")).toBe(0)
    })
  })
})
