import { matchDimension } from "@heleonix/hx-language"
import type { IDimensionDefinition } from "@heleonix/hx-language"

const definitions: readonly IDimensionDefinition[] = [
  { name: "culture", values: ["en-US", "uk-UA"] },
  { name: "customer", values: ["a", "b"] },
]

describe("matchDimension", () => {
  describe("given an unconstrained definition", () => {
    it("then matches any dimension with no specificity", () => {
      expect(matchDimension({}, { culture: "uk-UA" }, definitions)).toBe(0)
    })
  })

  describe("given a definition constrained on the current values", () => {
    it("then counts one specificity per constrained dimension", () => {
      expect(
        matchDimension({ culture: "uk-UA", customer: "b" }, { culture: "uk-UA", customer: "b" }, definitions),
      ).toBe(2)
    })
  })

  describe("given a definition constrained on another value", () => {
    it("then does not match", () => {
      expect(matchDimension({ culture: "en-US" }, { culture: "uk-UA" }, definitions)).toBeUndefined()
    })
  })

  describe("given a definition constrained on a dimension that is unset", () => {
    it("then does not match", () => {
      expect(matchDimension({ customer: "a" }, { culture: "uk-UA" }, definitions)).toBeUndefined()
    })
  })
})
