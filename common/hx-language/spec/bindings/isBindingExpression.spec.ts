import { isBindingExpression } from "@heleonix/hx-language"

describe("isBindingExpression", () => {
  describe("given a qualified dictionary reference", () => {
    describe("when the expression is checked", () => {
      it("then accepts it", () => {
        expect(isBindingExpression("@Buttons.save")).toBeTrue()
      })
    })
  })

  describe("given a bare sigil with no entry", () => {
    describe("when the expression is checked", () => {
      it("then rejects it - references need a name and entry", () => {
        expect(isBindingExpression("@Buttons")).toBeFalse()
      })
    })
  })

  describe("given boolean and number literals", () => {
    describe("when the expressions are checked", () => {
      it("then accepts them", () => {
        expect(isBindingExpression("true")).toBeTrue()
        expect(isBindingExpression("false")).toBeTrue()
        expect(isBindingExpression("42")).toBeTrue()
        expect(isBindingExpression("-0.5")).toBeTrue()
      })
    })
  })

  describe("given a converter chain with named arguments", () => {
    describe("when the expression is checked", () => {
      it("then accepts it", () => {
        expect(isBindingExpression("@Buttons.save | truncate(length: 40, ellipsis: @Buttons.dots)")).toBeTrue()
      })
    })
  })

  describe("given a single-quoted string literal", () => {
    describe("when the expression is checked", () => {
      it("then accepts it", () => {
        expect(isBindingExpression("'primary'")).toBeTrue()
        expect(isBindingExpression("''")).toBeTrue()
      })
    })
  })

  describe("given a malformed quoted token", () => {
    describe("when the expression is checked", () => {
      it("then rejects it - an interior quote is not a string literal", () => {
        expect(isBindingExpression("'a'b'")).toBeFalse()
        expect(isBindingExpression("'unterminated")).toBeFalse()
      })
    })
  })
})
