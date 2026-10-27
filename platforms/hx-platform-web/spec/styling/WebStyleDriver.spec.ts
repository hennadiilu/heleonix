import type { Component, IScheduler } from "@heleonix/hx-core"
import { WebStyleDriver, DomStyleSheet } from "@heleonix/hx-platform-web"

const immediate: IScheduler = {
  scheduleCompute: (job) => void job(),
  scheduleCommit: (job) => void job(),
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

function component(fqName: string): Component {
  return { fqName } as unknown as Component
}

function driverWith(roots: ReadonlyMap<Component, FakeElement> = new Map()): {
  driver: WebStyleDriver
  sheet: { textContent: string | null }
} {
  const sheet = { textContent: null as string | null }
  const rootsOf = (target: Component): HTMLElement[] => {
    const root = roots.get(target)

    return (root ? [root] : []) as unknown as HTMLElement[]
  }

  return { driver: new WebStyleDriver(new DomStyleSheet(sheet), rootsOf, immediate), sheet }
}

describe("WebStyleDriver", () => {
  it("then inserts each rule under its id: theme -> var(), pseudo condition -> :hover, {prop}px -> calc(var())", () => {
    const { driver, sheet } = driverWith()

    driver.insertRule({ id: "hx-a", conditions: [], declarations: { color: "{$Colors.Roles.Primary.bg}" } })
    driver.insertRule({ id: "hx-b", conditions: [{ pseudo: "Hover" }], declarations: { padding: "{someProp}px" } })

    expect(sheet.textContent).toBe(
      ".hx-a { color: var(--hx-colors-roles-primary-bg); }\n" +
        ".hx-b:hover { padding: calc(var(--hx--some-prop) * 1px); }",
    )
  })

  it("then writes classes and variables through the effect onto the component's own roots only", () => {
    const a = component("A")
    const b = component("B")
    const rootA = new FakeElement()
    const rootB = new FakeElement()
    const { driver } = driverWith(
      new Map([
        [a, rootA],
        [b, rootB],
      ]),
    )
    const effect = driver.effectFor(a)

    effect.addClass("hx-a")
    effect.addClass("hx-b")
    effect.setVariable({ name: "hx--some-prop", text: false }, "5")

    expect([...rootA.classes]).toEqual(["hx-a", "hx-b"])
    expect(rootA.style.props.get("--hx--some-prop")).toBe("5")
    expect(rootB.classes.size).toBe(0)
    expect(rootB.style.props.size).toBe(0)
  })

  it("then removes classes, variables and the sheet rule on teardown", () => {
    const b = component("B")
    const root = new FakeElement()
    const { driver, sheet } = driverWith(new Map([[b, root]]))
    const effect = driver.effectFor(b)
    const variable = { name: "hx--p", text: false }

    driver.insertRule({ id: "hx-a", conditions: [], declarations: { width: "{p}px" } })
    effect.addClass("hx-a")
    effect.setVariable(variable, "1")

    effect.removeClass("hx-a")
    effect.removeVariable(variable)
    driver.remove("hx-a")

    expect(root.classes.size).toBe(0)
    expect(root.style.props.has("--hx--p")).toBeFalse()
    expect(sheet.textContent).toBe("")
  })

  it("then inserts a keyframe under its id and removes it the same way", () => {
    const { driver, sheet } = driverWith()

    driver.insertKeyframes("hx-Button-pulse-1", { "50%": { transform: "scale(1.1)" } })
    expect(sheet.textContent).toBe("@keyframes hx-Button-pulse-1 { 50% { transform: scale(1.1); } }")

    driver.remove("hx-Button-pulse-1")
    expect(sheet.textContent).toBe("")
  })
})
