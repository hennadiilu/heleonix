import type { StyleHandle } from "@heleonix/hx-core"
import { WebStyleEffect } from "@heleonix/hx-platform-web"
import type { WebStyleHandle } from "@heleonix/hx-platform-web"

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
  public readonly attrs = new Map<string, string>()
  public readonly classes = new Set<string>()
  public readonly classList = {
    add: (name: string): void => void this.classes.add(name),
    remove: (name: string): void => void this.classes.delete(name),
  }

  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }

  public removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
}

function handle(className: string): StyleHandle {
  return { className } as WebStyleHandle as unknown as StyleHandle
}

describe("WebStyleEffect", () => {
  it("then mangles a variable key and sets/removes it on every root", () => {
    const a = new FakeElement()
    const b = new FakeElement()
    const effect = new WebStyleEffect([a, b] as unknown as HTMLElement[])

    effect.setVariable("someProp", "5px")
    expect(a.style.props.get("--hx-some-prop")).toBe("5px")
    expect(b.style.props.get("--hx-some-prop")).toBe("5px")

    effect.removeVariable("someProp")
    expect(a.style.props.has("--hx-some-prop")).toBeFalse()
  })

  it("then adds and removes the handle's class on every root", () => {
    const root = new FakeElement()
    const effect = new WebStyleEffect([root] as unknown as HTMLElement[])

    effect.setClass(handle("hx-abc"))
    expect(root.classes.has("hx-abc")).toBeTrue()

    effect.removeClass(handle("hx-abc"))
    expect(root.classes.has("hx-abc")).toBeFalse()
  })

  it("then toggles a gate attribute (for @hx-if) on every root", () => {
    const root = new FakeElement()
    const effect = new WebStyleEffect([root] as unknown as HTMLElement[])

    effect.setAttribute("data-hx-is-saving", "")
    expect(root.attrs.get("data-hx-is-saving")).toBe("")

    effect.removeAttribute("data-hx-is-saving")
    expect(root.attrs.has("data-hx-is-saving")).toBeFalse()
  })

  it("then writes inline CSSOM properties directly (no mangling)", () => {
    const root = new FakeElement()
    const effect = new WebStyleEffect([root] as unknown as HTMLElement[])

    effect.setProperty("color", "red")
    expect(root.style.props.get("color")).toBe("red")

    effect.removeProperty("color")
    expect(root.style.props.has("color")).toBeFalse()
  })
})
