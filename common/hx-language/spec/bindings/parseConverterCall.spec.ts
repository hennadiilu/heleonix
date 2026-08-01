import { parseConverterCall } from "@heleonix/hx-language"

describe("parseConverterCall", () => {
  describe("given a bare converter", () => {
    describe("when the segment is parsed", () => {
      it("then returns the name with empty arguments", () => {
        const result = parseConverterCall("Truncate")

        expect(result).toEqual({ name: "Truncate", args: {} })
      })
    })
  })

  describe("given a converter with named arguments of mixed source kinds", () => {
    describe("when the segment is parsed", () => {
      it("then parses each argument value as a binding source", () => {
        const result = parseConverterCall("Truncate(length: 10, unit: #Cfg.unit, ellipsis: 'dots', from: prop)")

        expect(result).toEqual({
          name: "Truncate",
          args: {
            length: { type: "literal", value: "10" },
            unit: { type: "config", value: "Cfg.unit" },
            ellipsis: { type: "literal", value: '"dots"' },
            from: { type: "state", value: "prop" },
          },
        })
      })
    })
  })

  describe("given a converter with empty parentheses", () => {
    describe("when the segment is parsed", () => {
      it("then throws, since the canonical spelling is bare", () => {
        expect(() => parseConverterCall("Truncate()")).toThrowError(/empty parentheses/)
      })
    })
  })

  describe("given an argument without a name", () => {
    describe("when the segment is parsed", () => {
      it("then throws, since arguments are named-only", () => {
        expect(() => parseConverterCall("Truncate(10)")).toThrowError(/must be named/)
      })
    })
  })

  describe("given an argument that is itself a converter chain", () => {
    describe("when the segment is parsed", () => {
      it("then throws, since arguments must be plain sources", () => {
        expect(() => parseConverterCall("Truncate(length: value | toNumber)")).toThrowError(/plain source/)
      })
    })
  })
})
