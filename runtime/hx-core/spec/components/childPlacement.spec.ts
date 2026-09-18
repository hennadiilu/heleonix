import { DeclarativeComponent, PlatformComponent } from "@heleonix/hx-core"
import { ComponentManager } from "../../src/components/ComponentManager"
import type { IComponentContext, IComponentManager } from "@heleonix/hx-core"
import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"

class FakeElement extends PlatformComponent {
  public static moves = 0

  public readonly slots: FakeElement[] = []

  public override mount(anchor?: PlatformComponent): void {
    const host = this.platformParent as FakeElement | undefined

    if (!host) {
      return
    }

    const at = host.slots.indexOf(this)
    const before = anchor instanceof FakeElement ? anchor : undefined

    if (at >= 0 && host.slots[at + 1] === before) {
      return
    }

    FakeElement.moves += 1

    if (at >= 0) {
      host.slots.splice(at, 1)
    }

    const target = before ? host.slots.indexOf(before) : -1

    if (target >= 0) {
      host.slots.splice(target, 0, this)
    } else {
      host.slots.push(this)
    }
  }

  public override unmount(): void {
    const host = this.platformParent as FakeElement | undefined
    const at = host ? host.slots.indexOf(this) : -1

    if (host && at >= 0) {
      host.slots.splice(at, 1)
    }
  }

  public override setProperty(): void {}

  public override setContent(): void {}
}

const emitter = { on: (): void => {}, off: (): void => {} }

function createContext(components: () => IComponentManager): IComponentContext {
  return {
    state: { changed: emitter, getValue: () => undefined, setValue: () => {}, emitEvent: () => {} },
    configs: { get: () => Promise.resolve(undefined) },
    dictionaries: { get: () => undefined },
    binder: {
      bind: () => undefined,
      unbind: () => {},
      rebind: () => {},
      getActiveEndpoints: () => [],
      endpointActivated: emitter,
      endpointDeactivated: emitter,
    },
    get components(): IComponentManager {
      return components()
    },
    scheduler: { scheduleCompute: () => {}, scheduleCommit: () => {} },
  } as unknown as IComponentContext
}

function item(name: string): IComponentUsage {
  return { tag: "item", name }
}

function group(tag: string, children: IComponentUsage[]): IComponentDefinition {
  return { tag, type: "DeclarativeComponent", children } as IComponentDefinition
}

function names(host: FakeElement): string[] {
  return host.slots.map((slot) => slot.usage.name ?? "?")
}

interface Harness {
  manager: ComponentManager
  host: FakeElement
  definitions: Map<string, IComponentDefinition>
}

function createHarness(definitions: Map<string, IComponentDefinition>): Harness {
  // The manager and the context each need the other, so the manager is handed a
  // thunk resolved on first use rather than at construction.
  const manager = new ComponentManager(
    { loadDefinition: (tag: string) => Promise.resolve(definitions.get(tag)) } as never,
    { current: {} } as never,
    {} as never,
    {} as never,
    new Map<string, never>([
      ["DeclarativeComponent", DeclarativeComponent as never],
      ["FakeElement", FakeElement as never],
    ]),
    () => context,
    undefined,
  )

  const context = createContext(() => manager)

  const host = new FakeElement(context)

  FakeElement.moves = 0

  return { manager, host, definitions }
}

describe("child placement", () => {
  const itemDefinition = { tag: "item", type: "FakeElement" } as IComponentDefinition

  it("then renders children in definition order on the first build", async () => {
    const { manager, host } = createHarness(
      new Map([
        ["List", group("List", [item("a"), item("b"), item("c")])],
        ["item", itemDefinition],
      ]),
    )

    await manager.build({ tag: "List", name: "List" }, undefined, undefined, host)

    expect(names(host)).toEqual(["a", "b", "c"])
  })

  it("then places an inserted child at its definition position, not at the end", async () => {
    const definitions = new Map([
      ["List", group("List", [item("a"), item("c")])],
      ["item", itemDefinition],
    ])
    const { manager, host } = createHarness(definitions)

    const list = await manager.build({ tag: "List", name: "List" }, undefined, undefined, host)

    definitions.set("List", group("List", [item("a"), item("b"), item("c")]))

    await manager.update(list, list.usage)

    expect(names(host)).toEqual(["a", "b", "c"])
  })

  it("then reorders with one move per displaced child, leaving the settled run untouched", async () => {
    const definitions = new Map([
      ["List", group("List", [item("a"), item("b"), item("c")])],
      ["item", itemDefinition],
    ])
    const { manager, host } = createHarness(definitions)

    const list = await manager.build({ tag: "List", name: "List" }, undefined, undefined, host)

    const before = [...host.slots]

    FakeElement.moves = 0

    definitions.set("List", group("List", [item("c"), item("a"), item("b")]))

    await manager.update(list, list.usage)

    expect(names(host)).toEqual(["c", "a", "b"])
    expect(FakeElement.moves).toBe(1)
    // The same instances moved, rather than being torn down and rebuilt.
    expect(host.slots.every((slot) => before.includes(slot))).toBe(true)
  })

  it("then anchors past its own owner, so a sibling group's content stays behind the insert", async () => {
    const definitions = new Map([
      ["Page", group("Page", [{ tag: "First" }, { tag: "Second" }])],
      ["First", group("First", [item("x")])],
      ["Second", group("Second", [item("z")])],
      ["item", itemDefinition],
    ])
    const { manager, host } = createHarness(definitions)

    const page = await manager.build({ tag: "Page", name: "Page" }, undefined, undefined, host)

    expect(names(host)).toEqual(["x", "z"])

    const first = page.children[0]

    definitions.set("First", group("First", [item("x"), item("y")]))

    await manager.update(first, first.usage)

    expect(names(host)).toEqual(["x", "y", "z"])
  })

  it("then removes a departed child from the host and keeps the rest in order", async () => {
    const definitions = new Map([
      ["List", group("List", [item("a"), item("b"), item("c")])],
      ["item", itemDefinition],
    ])
    const { manager, host } = createHarness(definitions)

    const list = await manager.build({ tag: "List", name: "List" }, undefined, undefined, host)

    definitions.set("List", group("List", [item("a"), item("c")]))

    await manager.update(list, list.usage)

    expect(names(host)).toEqual(["a", "c"])
  })

  it("then keeps every anonymous sibling of one tag across an update, rather than collapsing them", async () => {
    const anonymous = (): IComponentUsage => ({ tag: "item" })
    const definitions = new Map([
      ["List", group("List", [anonymous(), anonymous(), anonymous()])],
      ["item", itemDefinition],
    ])
    const { manager, host } = createHarness(definitions)

    const list = await manager.build({ tag: "List", name: "List" }, undefined, undefined, host)

    const before = [...host.slots]

    expect(before.length).toBe(3)

    await manager.update(list, list.usage)

    expect(host.slots).toEqual(before)
  })
})
