import { StateManager } from "../../src/state/StateManager"
import { joinFQPropertyName } from "@heleonix/hx-language"

function stateManager(): StateManager {
  return new StateManager()
}

const fq = (component: string, property: string): string => joinFQPropertyName(component, property)

interface Change {
  fq: string
  newValue: unknown
  oldValue: unknown
}

// Records every `changed` emission for a path so a spec can assert what fired.
function watch(state: StateManager, path: string): Change[] {
  const changes: Change[] = []

  state.changed.on(path, (emittedFq, newValue, oldValue) => changes.push({ fq: emittedFq, newValue, oldValue }))

  return changes
}

describe("StateManager", () => {
  describe("getValue / setValue", () => {
    it("then reads back a value that was written", () => {
      const state = stateManager()

      state.setValue(fq("app", "count"), 5)

      expect(state.getValue(fq("app", "count"))).toBe(5)
    })

    it("then reads a nested path and its parent object", () => {
      const state = stateManager()

      state.setValue(fq("app", "user.name"), "bob")

      expect(state.getValue(fq("app", "user.name"))).toBe("bob")
      expect(state.getValue(fq("app", "user"))).toEqual({ name: "bob" })
    })

    it("then returns undefined for a path that was never written", () => {
      expect(stateManager().getValue(fq("app", "missing"))).toBeUndefined()
    })

    it("then does not notify when the value is unchanged (Object.is)", () => {
      const state = stateManager()

      state.setValue(fq("app", "count"), 5)
      const changes = watch(state, fq("app", "count"))

      state.setValue(fq("app", "count"), 5)

      expect(changes.length).toBe(0)
    })
  })

  describe("changed", () => {
    it("then notifies a leaf subscriber with new and old values", () => {
      const state = stateManager()

      state.setValue(fq("app", "count"), 1)
      const changes = watch(state, fq("app", "count"))

      state.setValue(fq("app", "count"), 2)

      expect(changes).toEqual([{ fq: fq("app", "count"), newValue: 2, oldValue: 1 }])
    })

    it("then notifies a parent subscriber when a child changes", () => {
      const state = stateManager()

      state.setValue(fq("app", "user.name"), "bob")
      const changes = watch(state, fq("app", "user"))

      state.setValue(fq("app", "user.name"), "alice")

      expect(changes.length).toBe(1)
      expect(changes[0].newValue).toEqual({ name: "alice" })
    })

    it("then notifies a child subscriber when the parent object is replaced", () => {
      const state = stateManager()

      state.setValue(fq("app", "user"), { name: "bob" })
      const changes = watch(state, fq("app", "user.name"))

      state.setValue(fq("app", "user"), { name: "alice" })

      expect(changes).toEqual([{ fq: fq("app", "user.name"), newValue: "alice", oldValue: "bob" }])
    })

    it("then stops notifying after off", () => {
      const state = stateManager()
      const changes: unknown[] = []
      const handler = (_fq: string, value: unknown): void => void changes.push(value)

      state.changed.on(fq("app", "count"), handler)
      state.setValue(fq("app", "count"), 1)
      state.changed.off(fq("app", "count"), handler)
      state.setValue(fq("app", "count"), 2)

      expect(changes).toEqual([1])
    })
  })

  describe("bind", () => {
    it("then seeds the target from the source on bind", () => {
      const state = stateManager()

      state.setValue(fq("app", "source"), "hi")
      state.bind(fq("app", "target"), fq("app", "source"))

      expect(state.getValue(fq("app", "target"))).toBe("hi")
    })

    it("then propagates changes both ways (symmetric alias)", () => {
      const state = stateManager()

      state.bind(fq("app", "target"), fq("app", "source"))

      state.setValue(fq("app", "source"), 1)
      expect(state.getValue(fq("app", "target"))).toBe(1)

      state.setValue(fq("app", "target"), 2)
      expect(state.getValue(fq("app", "source"))).toBe(2)
    })

    it("then stops propagating after unbind", () => {
      const state = stateManager()

      state.bind(fq("app", "target"), fq("app", "source"))
      state.unbind(fq("app", "target"), fq("app", "source"))

      state.setValue(fq("app", "source"), 9)

      expect(state.getValue(fq("app", "target"))).toBeUndefined()
    })
  })

  describe("emitEvent", () => {
    it("then delivers the payload to a subscriber but leaves no stored value", () => {
      const state = stateManager()
      const seen: unknown[] = []

      state.changed.on(fq("Button", "click"), (_fq, value) => void seen.push(value))

      state.emitEvent(fq("Button", "click"), { x: 10 })

      expect(seen).toEqual([{ x: 10 }])
      expect(state.getValue(fq("Button", "click"))).toBeUndefined()
    })
  })
})
