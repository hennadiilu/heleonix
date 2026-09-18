import { stringLiteralExpression } from "@heleonix/hx-language"

describe("stringLiteralExpression", () => {
  describe("given the static text of a quoted attribute value", () => {
    describe("when the binding is built", () => {
      it("then returns a literal carrying the text in its JSON form", () => {
        expect(stringLiteralExpression("primary")).toEqual({ type: "literal", value: '"primary"' })
      })
    })
  })

  describe("given text that needs escaping", () => {
    describe("when the binding is built", () => {
      it("then keeps the value parseable by a single JSON.parse", () => {
        const binding = stringLiteralExpression('say "hi"')

        expect(JSON.parse(binding.value)).toBe('say "hi"')
      })
    })
  })
})
