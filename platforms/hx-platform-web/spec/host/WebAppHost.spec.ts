import { WebAppHost } from "@heleonix/hx-platform-web"

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

  public appendChild(): void {}
}

const globals = globalThis as unknown as { document?: unknown }

const asRoot = (element: FakeElement): HTMLElement => element as unknown as HTMLElement

describe("WebAppHost", () => {
  let documentElement: FakeElement

  beforeEach(() => {
    documentElement = new FakeElement()
    globals.document = { documentElement }
  })

  afterEach(() => {
    delete globals.document
  })

  it("then publishes a variable on the root host once it is known", () => {
    const host = new WebAppHost()
    const root = new FakeElement()

    host.setRoot(asRoot(root))
    host.publishVariable("--hx-a", "1")

    expect(root.style.props.get("--hx-a")).toBe("1")
    expect(documentElement.style.props.size).toBe(0)
  })

  it("then re-homes a variable published before the root is known under the root", () => {
    const host = new WebAppHost()
    const root = new FakeElement()

    host.publishVariable("--hx-a", "1")
    host.setRoot(asRoot(root))

    expect(root.style.props.get("--hx-a")).toBe("1")
    expect(documentElement.style.props.size).toBe(0)
  })

  it("then removes on clear the variables it published on the root", () => {
    const host = new WebAppHost()
    const root = new FakeElement()

    host.setRoot(asRoot(root))
    host.publishVariable("--hx-a", "1")
    host.clear()

    expect(root.style.props.size).toBe(0)
  })

  it("then removes on clear a variable that never got a root, so a headless application leaves nothing on the document", () => {
    const host = new WebAppHost()

    host.publishVariable("--hx-a", "1")
    host.clear()

    expect(documentElement.style.props.size).toBe(0)
  })

  it("then re-homes a variable published between runs under the next run's root, so a late write does not stay on the document", () => {
    const host = new WebAppHost()
    const next = new FakeElement()

    host.setRoot(asRoot(new FakeElement()))
    host.clear()
    host.publishVariable("--hx-a", "1")
    host.setRoot(asRoot(next))

    expect(next.style.props.get("--hx-a")).toBe("1")
    expect(documentElement.style.props.size).toBe(0)
  })
})
