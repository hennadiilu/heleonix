import { stringifyDimension } from "@heleonix/hx-language"
import type { IDimensionDefinition } from "@heleonix/hx-language"

const definitions: readonly IDimensionDefinition[] = [
  { name: "customer", values: ["x", "a.b", "a", ""] },
  { name: "culture", values: ["x", "b"] },
]

describe("stringifyDimension", () => {
  describe("given a dimension set on every declared name", () => {
    it("then encodes the values in declaration order, whatever order the dimension lists them in", () => {
      expect(stringifyDimension({ culture: "b", customer: "a" }, definitions)).toBe('["a","b"]')
    })
  })

  describe("given dimensions that differ only in which name carries a shared value", () => {
    it("then keys them apart", () => {
      expect(stringifyDimension({ customer: "x" }, definitions)).not.toBe(
        stringifyDimension({ culture: "x" }, definitions),
      )
    })
  })

  describe("given a value containing the former separator", () => {
    it("then keys it apart from the two values it would have joined into", () => {
      expect(stringifyDimension({ customer: "a.b" }, definitions)).not.toBe(
        stringifyDimension({ customer: "a", culture: "b" }, definitions),
      )
    })
  })

  describe("given an empty-string value", () => {
    it("then keys it apart from an unset dimension", () => {
      expect(stringifyDimension({ customer: "" }, definitions)).not.toBe(stringifyDimension({}, definitions))
    })
  })
})
