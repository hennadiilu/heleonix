import { StateManagerStyleState } from "@heleonix/hx-core"
import type { Component, StateManager } from "@heleonix/hx-core"

type Handler = (name: string, newValue: unknown, oldValue: unknown) => void

class FakeChanged {
  private readonly handlers = new Map<string, Handler[]>()

  public on(key: string, handler: Handler): void {
    const list = this.handlers.get(key) ?? []
    list.push(handler)
    this.handlers.set(key, list)
  }

  public off(key: string, handler: Handler): void {
    this.handlers.set(
      key,
      (this.handlers.get(key) ?? []).filter((h) => h !== handler),
    )
  }

  public emit(key: string): void {
    for (const handler of [...(this.handlers.get(key) ?? [])]) {
      handler(key, undefined, undefined)
    }
  }

  public count(key: string): number {
    return (this.handlers.get(key) ?? []).length
  }
}

class FakeStateManager {
  public readonly changed = new FakeChanged()
  public readonly values = new Map<string, unknown>()

  public getValue(name: string): unknown {
    return this.values.get(name)
  }
}

function componentNamed(fqName: string): Component {
  return { fqName } as unknown as Component
}

describe("StateManagerStyleState", () => {
  it("then reads a component property via its fully-qualified name", () => {
    const stateManager = new FakeStateManager()
    stateManager.values.set("App.Card:isSaving", true)
    const state = new StateManagerStyleState(stateManager as unknown as StateManager)

    expect(state.getValue(componentNamed("App.Card"), "isSaving")).toBeTrue()
  })

  it("then subscribes through the changed emitter and unsubscribes on cleanup", () => {
    const stateManager = new FakeStateManager()
    const state = new StateManagerStyleState(stateManager as unknown as StateManager)
    let calls = 0

    const unsubscribe = state.subscribe(componentNamed("App.Card"), "isSaving", () => {
      calls += 1
    })
    expect(stateManager.changed.count("App.Card:isSaving")).toBe(1)

    stateManager.changed.emit("App.Card:isSaving")
    expect(calls).toBe(1)

    unsubscribe()
    stateManager.changed.emit("App.Card:isSaving")
    expect(calls).toBe(1)
    expect(stateManager.changed.count("App.Card:isSaving")).toBe(0)
  })
})
