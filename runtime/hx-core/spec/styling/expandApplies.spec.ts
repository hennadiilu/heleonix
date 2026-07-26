import { expandApplies } from "@heleonix/hx-core"
import type { IStyleDefinition } from "@heleonix/hx-language"

const groups = {
  Typography: { Heading: { "font-size": "2rem", "font-weight": "700" } },
  Colors: { Danger: { color: "red", background: "pink" } },
}

function def(partial: Partial<IStyleDefinition>): IStyleDefinition {
  return { name: "X", dimension: {}, rules: {}, ...partial }
}

describe("expandApplies", () => {
  it("then returns the definition untouched when it has no applies", () => {
    const definition = def({ rules: { "": { color: "red" } } })

    expect(expandApplies(definition, groups)).toBe(definition)
  })

  it("then expands a group's leaf tokens into declarations and drops applies", () => {
    const result = expandApplies(def({ applies: { "": ["Typography.Heading"] } }), groups)

    expect(result.rules).toEqual({ "": { "font-size": "2rem", "font-weight": "700" } })
    expect(result.applies).toBeUndefined()
  })

  it("then lets explicit declarations win over applied ones", () => {
    const result = expandApplies(
      def({ rules: { "": { "font-size": "3rem" } }, applies: { "": ["Typography.Heading"] } }),
      groups,
    )

    expect(result.rules[""]).toEqual({ "font-size": "3rem", "font-weight": "700" })
  })

  it("then lets a later apply override an earlier one", () => {
    const result = expandApplies(def({ applies: { "": ["Typography.Heading", "Colors.Danger"] } }), groups)

    expect(result.rules[""].color).toBe("red")
    expect(result.rules[""]["font-size"]).toBe("2rem")
  })

  it("then contributes nothing for an unresolved or leaf token", () => {
    const result = expandApplies(def({ applies: { "": ["Typography.Missing"] } }), groups)

    expect(result.rules).toEqual({ "": {} })
  })

  it("then preserves keyframes and dimension on the expanded definition", () => {
    const keyframes = { pulse: { "50%": { transform: "scale(1.1)" } } }
    const result = expandApplies(def({ applies: { "": ["Colors.Danger"] }, keyframes }), groups)

    expect(result.keyframes).toEqual(keyframes)
  })
})
