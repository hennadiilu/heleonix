import { StyleManager } from "../../../../runtime/hx-core/src/styling/StyleManager"
import { BindingEvaluator, LiteralValueSource, StateValueSource } from "@heleonix/hx-core"
import type { Component, IQualifierProvider, IScheduler, IState } from "@heleonix/hx-core"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { WebStyleDriver, RefcountedStyleSheet, DomStyleSheet } from "@heleonix/hx-platform-web"

const immediate: IScheduler = {
  scheduleCompute: (job) => void job(),
  scheduleCommit: (job) => void job(),
}

const components = new Map<string, Component>()

function cmp(fqName: string): Component {
  let component = components.get(fqName)

  if (!component) {
    component = { fqName } as unknown as Component
    components.set(fqName, component)
  }

  return component
}

class FakeStyle {
  public readonly props = new Map<string, string>()
  public setProperty(name: string, value: string): void {
    this.props.set(name, value)
  }
  public removeProperty(name: string): void {
    this.props.delete(name)
  }
}

class FakeElement {
  public readonly style = new FakeStyle()
  public readonly classes = new Set<string>()
  public readonly classList = {
    add: (name: string): void => void this.classes.add(name),
    remove: (name: string): void => void this.classes.delete(name),
  }
  public setAttribute(): void {}
  public removeAttribute(): void {}
}

function stateWith(values: Record<string, unknown>): IState {
  return {
    changed: { on: () => {}, off: () => {} },
    getValue: (name: string) => values[name],
    setValue: () => {},
    emitEvent: () => {},
  } as unknown as IState
}

function managerWith(driver: WebStyleDriver, qualifiers: IQualifierProvider, values: Record<string, unknown>) {
  const state = stateWith(values)

  return new StyleManager(
    () => driver,
    { loadDefinition: () => Promise.resolve(undefined) } as never,
    { getTheme: () => Promise.resolve(undefined) } as never,
    state,
    new BindingEvaluator({ get: () => ({}) as never }, [new StateValueSource(state), new LiteralValueSource()]),
    qualifiers,
  )
}

function def(rules: IStyleDefinition["rules"]): IStyleDefinition {
  return { name: "Card", dimension: {}, rules }
}

describe("web styling runtime (StyleManager + WebStyleDriver)", () => {
  it("then applies a compiled style end to end: sheet rules, classes and {prop} variables", async () => {
    const element = { textContent: null as string | null }
    const sheet = new RefcountedStyleSheet(new DomStyleSheet(element))
    const root = new FakeElement()

    const hover = { build: () => ({ pseudo: "Hover" }) }
    const qualifiers: IQualifierProvider = { get: (name) => (name === "Hover" ? hover : undefined) }

    const driver = new WebStyleDriver(sheet, (c) => (c === cmp("A") ? [root as unknown as HTMLElement] : []), immediate)
    const manager = managerWith(driver, qualifiers, { "A:someProp": "5" })

    await manager.applyDefinition(
      cmp("A"),
      def({ "": { color: "{$Colors.Roles.Primary.bg}" }, Hover: { padding: "{someProp}px" } }),
    )

    // Two content-hashed classes on the root.
    expect(root.classes.size).toBe(2)

    // Composed CSS in the sheet: theme -> var(), pseudo fragment -> :hover, {prop}px -> calc(var()).
    expect(element.textContent).toContain("color: var(--hx-colors-roles-primary-bg);")
    expect(element.textContent).toContain(":hover { padding: calc(var(--hx-some-prop) * 1px); }")

    // The {prop} value is pushed as a per-instance CSS variable.
    expect(root.style.props.get("--hx-some-prop")).toBe("5")
  })

  it("then removes classes, variables and the sheet rules on teardown", async () => {
    const element = { textContent: null as string | null }
    const sheet = new RefcountedStyleSheet(new DomStyleSheet(element))
    const root = new FakeElement()
    const driver = new WebStyleDriver(sheet, () => [root as unknown as HTMLElement], immediate)
    const manager = managerWith(driver, { get: () => undefined }, { "B:p": 1 })

    await manager.applyDefinition(cmp("B"), def({ "": { width: "{p}px" } }))
    manager.remove(cmp("B"))

    expect(root.classes.size).toBe(0)
    expect(root.style.props.has("--hx-p")).toBeFalse()
    expect(element.textContent).toBe("")
  })
})
