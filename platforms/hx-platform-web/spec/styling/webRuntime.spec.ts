import { StyleEngine, QualifierRegistry } from "@heleonix/hx-core"
import type { StyleEngineState } from "@heleonix/hx-core"
import type { IStyleDefinition } from "@heleonix/hx-language"
import { WebStyleEnginePlatform, RefcountedStyleSheet, DomStyleSheet } from "@heleonix/hx-platform-web"

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
}

function def(rules: IStyleDefinition["rules"]): IStyleDefinition {
  return { name: "Card", dimension: {}, rules }
}

describe("web styling runtime (StyleEngine + WebStyleEnginePlatform)", () => {
  it("then applies a compiled style end to end: sheet rules, classes and {prop} variables", () => {
    const element = { textContent: null as string | null }
    const sheet = new RefcountedStyleSheet(new DomStyleSheet(element))
    const root = new FakeElement()

    const registry = new QualifierRegistry()
    registry.register("Hover", { build: () => ({ pseudo: "Hover" }) })

    const platform = new WebStyleEnginePlatform<string>(sheet, (c) =>
      c === "A" ? [root as unknown as HTMLElement] : [],
    )
    const engine = new StyleEngine<string>(registry, platform, new FakeState({ someProp: "5" }))

    engine.apply("A", def({ "": { color: "{$Colors.Roles.Primary.bg}" }, Hover: { padding: "{someProp}px" } }))

    // Two content-hashed classes on the root.
    expect(root.classes.size).toBe(2)

    // Composed CSS in the sheet: theme -> var(), pseudo fragment -> :hover, {prop}px -> calc(var()).
    expect(element.textContent).toContain("color: var(--hx-colors-roles-primary-bg);")
    expect(element.textContent).toContain(":hover { padding: calc(var(--hx-some-prop) * 1px); }")

    // The {prop} value is pushed as a per-instance CSS variable.
    expect(root.style.props.get("--hx-some-prop")).toBe("5")
  })

  it("then removes classes, variables and the sheet rules on teardown", () => {
    const element = { textContent: null as string | null }
    const sheet = new RefcountedStyleSheet(new DomStyleSheet(element))
    const root = new FakeElement()
    const platform = new WebStyleEnginePlatform<string>(sheet, () => [root as unknown as HTMLElement])
    const engine = new StyleEngine<string>(new QualifierRegistry(), platform, new FakeState({ p: 1 }))

    engine.apply("A", def({ "": { width: "{p}px" } }))
    engine.remove("A")

    expect(root.classes.size).toBe(0)
    expect(root.style.props.has("--hx-p")).toBeFalse()
    expect(element.textContent).toBe("")
  })
})
