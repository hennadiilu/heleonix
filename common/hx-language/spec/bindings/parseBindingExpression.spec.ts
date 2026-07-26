import { parseBindingExpression } from "@heleonix/hx-language"

describe("parseBindingExpression", () => {
  describe("given a dictionary reference source", () => {
    describe("when the expression is parsed", () => {
      it("then returns the dictionary type with the path after the prefix", () => {
        const result = parseBindingExpression("@Buttons.save")

        expect(result).toEqual({ type: "dictionary", value: "Buttons.save" })
      })
    })
  })

  describe("given a boolean literal source", () => {
    describe("when the expression is parsed", () => {
      it("then returns the literal type with the raw text as the value", () => {
        const result = parseBindingExpression("true")

        expect(result).toEqual({ type: "literal", value: "true" })
      })
    })
  })

  describe("given a number literal source", () => {
    describe("when the expression is parsed", () => {
      it("then returns the literal type with the raw text as the value", () => {
        const result = parseBindingExpression("-1.5")

        expect(result).toEqual({ type: "literal", value: "-1.5" })
      })
    })
  })

  describe("given a single-quoted string literal source", () => {
    describe("when the expression is parsed", () => {
      it("then returns the literal type with the JSON-normalized value", () => {
        const result = parseBindingExpression("'primary'")

        expect(result).toEqual({ type: "literal", value: '"primary"' })
      })
    })
  })

  describe("given a string literal with converters", () => {
    describe("when the expression is parsed", () => {
      it("then returns the literal source with the converter chain", () => {
        const result = parseBindingExpression("'ok' | upper")

        expect(result).toEqual({ type: "literal", value: '"ok"', converters: ["upper"] })
      })
    })
  })

  describe("given an identifier that only resembles a literal", () => {
    describe("when the expression is parsed", () => {
      it("then returns the state type, not a literal", () => {
        const result = parseBindingExpression("trueValue")

        expect(result).toEqual({ type: "state", value: "trueValue" })
      })
    })
  })
})
