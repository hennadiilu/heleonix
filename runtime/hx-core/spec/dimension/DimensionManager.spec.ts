import { DimensionManager } from "../../src/dimension/DimensionManager"
import { HeleonixError } from "../../src/errors/HeleonixError"
import { Errors } from "../../src/errors/Errors"
import type { IDimension, IDimensionDefinition } from "@heleonix/hx-language"

const definitions: readonly IDimensionDefinition[] = [
  { name: "culture", values: ["en-US", "uk-UA"] },
  { name: "env", values: ["dev", "prod"] },
]

function managerWith(): { manager: DimensionManager; changes: IDimension[] } {
  const manager = new DimensionManager(definitions)
  const changes: IDimension[] = []

  manager.changed.on((dimension) => changes.push({ ...dimension }))

  return { manager, changes }
}

describe("DimensionManager.update", () => {
  it("then applies a declared diff and emits the new dimension", () => {
    const { manager, changes } = managerWith()

    manager.update({ culture: "en-US" })

    expect(manager.current).toEqual({ culture: "en-US" })
    expect(manager.currentKey).toBe("en-US")
    expect(changes).toEqual([{ culture: "en-US" }])
  })

  it("then rejects a dimension no definition declares", () => {
    const { manager, changes } = managerWith()

    expect(() => manager.update({ theme: "dark" })).toThrowMatching(
      (e: HeleonixError) => e.code === Errors.unknownDimension.code,
    )

    expect(manager.current).toEqual({})
    expect(changes).toEqual([])
  })

  it("then rejects a value its dimension does not declare", () => {
    const { manager, changes } = managerWith()

    expect(() => manager.update({ culture: "de-DE" })).toThrowMatching(
      (e: HeleonixError) => e.code === Errors.invalidDimensionValue.code,
    )

    expect(manager.current).toEqual({})
    expect(changes).toEqual([])
  })

  it("then rejects the whole diff when one of its dimensions is invalid", () => {
    const { manager, changes } = managerWith()

    expect(() => manager.update({ culture: "en-US", env: "staging" })).toThrow()

    expect(manager.current).toEqual({})
    expect(changes).toEqual([])
  })

  it("then stays silent when the diff changes nothing, so no theme, style or root reconcile is triggered", () => {
    const { manager, changes } = managerWith()

    manager.update({ culture: "en-US", env: "dev" })
    manager.update({ culture: "en-US" })
    manager.update({})

    expect(changes.length).toBe(1)
  })

  it("then emits when a diff changes one of several dimensions", () => {
    const { manager, changes } = managerWith()

    manager.update({ culture: "en-US", env: "dev" })
    manager.update({ culture: "en-US", env: "prod" })

    expect(manager.current).toEqual({ culture: "en-US", env: "prod" })
    expect(changes.length).toBe(2)
  })
})
