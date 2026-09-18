import { ComponentScopeResolver, IfQualifier, MediaQualifier, PseudoQualifier } from "@heleonix/hx-core"
import { QualifierProvider } from "../../src/styling/qualifiers/QualifierProvider"
import { StyleManager } from "../../src/styling/StyleManager"
import type {
  Component,
  IStyleDriver,
  IStyleEffect,
  IStyleQualifier,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import { stringifyRuleKey } from "@heleonix/hx-language"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { FakeDefinitionLoader, FakeState, FakeThemeManager, managerWith } from "./styleManagerFakes"

const SCOPE_KEY = stringifyRuleKey([{ name: "Style", args: { for: "body" } }])

class FakeEffect implements IStyleEffect {
  public readonly classesSet: StyleHandle[] = []
  public readonly classesRemoved: StyleHandle[] = []
  public setAttribute(): void {}
  public removeAttribute(): void {}
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
  public readonly keyframes: string[] = []
  public readonly effect = new FakeEffect()

  public compose(
    signature: string,
    _fragments: readonly StyleFragment[],
    declarations: Readonly<Record<string, string>>,
  ): StyleHandle {
    this.composed.push(signature)
    this.composedDecls.push({ ...declarations })

    return { signature } as unknown as StyleHandle
  }

  public composeKeyframe(scope: string, name: string): StyleHandle {
    this.keyframes.push(`${scope}/${name}`)

    return { keyframe: `${scope}/${name}` } as unknown as StyleHandle
  }

  public release(): void {}

  public effectFor(): IStyleEffect {
    return this.effect
  }
}

const DEFINITIONS: Record<string, IStyleDefinition> = {
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

interface FakeComponent {
  fqName: string
  definition: { tag: string }
  usage: { name?: string }
  children: FakeComponent[]
  parent?: FakeComponent
}

function componentTree(tag: string, name?: string, parent?: FakeComponent): FakeComponent {
  const component: FakeComponent = {
    fqName: name ?? tag,
    definition: { tag },
    usage: { name },
    children: [],
    parent,
  }

  parent?.children.push(component)

  return component
}

function componentOf(tag: string): Component {
  return componentTree(tag) as unknown as Component
}

function built(manager: StyleManager, component: FakeComponent): Promise<void> {
  return manager.apply(component as unknown as Component)
}

function spyOnApplyOwn(manager: StyleManager): jasmine.Spy {
  return spyOn(manager as unknown as { applyOwn(component: Component): Promise<void> }, "applyOwn").and.resolveTo()
}

function subject(): {
  manager: StyleManager
  driver: FakeStyleDriver
  theme: FakeThemeManager
} {
  const driver = new FakeStyleDriver()
  const theme = new FakeThemeManager()
  const state = new FakeState()

  theme.groups = {
    Typography: { Heading: { "font-size": "2rem", color: "blue" } },
    Colors: { Danger: { color: "red", background: "pink" } },
  }

  const context = { state: state.asState() }
  const qualifiers = new QualifierProvider(
    new Map<string, IStyleQualifier>([
      ["Media", new MediaQualifier(context)],
      ["If", new IfQualifier(context)],
    ]),
    new PseudoQualifier(context),
  )

  const manager = managerWith({
    driver,
    loader: new FakeDefinitionLoader(DEFINITIONS),
    theme,
    state,
    qualifiers,
    scope: new ComponentScopeResolver(),
  })

  return { manager, driver, theme }
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

  it("then expands @hx-apply groups against the theme, with explicit declarations winning", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Applied"))

    expect(driver.composedDecls).toEqual([{ "font-size": "2rem", color: "red" }])
  })

  it("then re-expands @hx-apply against the current theme when re-applied (brand overlay switch)", async () => {
    const { manager, driver, theme } = subject()
    const component = componentOf("Applied")

    await manager.apply(component)
    expect(driver.composedDecls.at(-1)).toEqual({ "font-size": "2rem", color: "red" })

    theme.groups = { Typography: { Heading: { "font-size": "3rem", color: "blue" } } }
    await manager.apply(component)

    expect(driver.composedDecls.at(-1)).toEqual({ "font-size": "3rem", color: "red" })
  })

  it("then lets a later @hx-apply group override an earlier one", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Layered"))

    expect(driver.composedDecls).toEqual([{ "font-size": "2rem", color: "red", background: "pink" }])
  })

  it("then contributes nothing for an @hx-apply path that resolves to no group", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Unresolved"))

    expect(driver.composedDecls).toEqual([{}])
  })

  it("then keeps local keyframes while expanding @hx-apply", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Animated"))

    expect(driver.composedDecls).toEqual([{ color: "red", background: "pink" }])
    expect(driver.keyframes).toEqual(["Animated/pulse"])
  })

  it("then re-styles every styled component on reapply, which the application runs on a dimension change", async () => {
    const { manager, driver } = subject()

    await manager.apply(componentOf("Button"))
    expect(driver.composed).toEqual([""])

    await manager.reapply()

    expect(driver.composed).toEqual(["", ""])
  })

  it("then re-styles a scoped ancestor when a descendant is built later", async () => {
    const { manager } = subject()
    const parent = componentTree("Scoped")

    await manager.apply(parent as unknown as Component)

    const applySpy = spyOnApplyOwn(manager)
    const child = componentTree("Child", "body", parent)

    await built(manager, child)

    expect(applySpy).toHaveBeenCalledWith(child as unknown as Component)
    expect(applySpy).toHaveBeenCalledWith(parent as unknown as Component)
  })

  it("then composes the ancestor's scoped rule only once the matching descendant exists", async () => {
    const { manager, driver } = subject()
    const parent = componentTree("Scoped")

    await manager.apply(parent as unknown as Component)
    expect(driver.composed).toEqual([])

    const child = componentTree("Child", "body", parent)
    await built(manager, child)

    expect(driver.composed).toContain(SCOPE_KEY)
  })

  it("then does not re-style an unscoped ancestor when a descendant is built", async () => {
    const { manager } = subject()
    const parent = componentTree("Button")

    await manager.apply(parent as unknown as Component)

    const applySpy = spyOnApplyOwn(manager)
    const child = componentTree("Child", "body", parent)

    await built(manager, child)

    expect(applySpy).not.toHaveBeenCalledWith(parent as unknown as Component)
  })
})
