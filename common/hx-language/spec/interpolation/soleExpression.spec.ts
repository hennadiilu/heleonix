import { soleExpression } from "@heleonix/hx-language"

describe("soleExpression", () => {
  describe("given a value that is one braced expression", () => {
    describe("when the value is read", () => {
      it("then returns the inner text with the offsets it spans", () => {
        const result = soleExpression("{userName}")

        expect(result).toEqual({ text: "userName", start: 1, end: 9 })
      })
    })
  })

  describe("given a braced expression padded with whitespace", () => {
    describe("when the value is read", () => {
      it("then reports the offsets of the inner text within the original value", () => {
        const value = "\n  {@Buttons.save}\n"
        const result = soleExpression(value)!

        expect(value.slice(result.start, result.end)).toBe("@Buttons.save")
      })
    })
  })

  describe("given static text", () => {
    describe("when the value is read", () => {
      it("then returns undefined, since it binds as a string literal", () => {
        expect(soleExpression("Save changes")).toBeUndefined()
      })
    })
  })

  describe("given text that only partly consists of a braced expression", () => {
    describe("when the value is read", () => {
      it("then returns undefined - a value is either static or one expression", () => {
        expect(soleExpression("Hi {name}")).toBeUndefined()
        expect(soleExpression("{a} {b}")).toBeUndefined()
      })
    })
  })

  describe("given an expression holding a closing brace inside a string literal", () => {
    describe("when the value is read", () => {
      it("then does not end the expression early", () => {
        const result = soleExpression("{x | Pick(fallback: '}')}")

        expect(result?.text).toBe("x | Pick(fallback: '}')")
      })
    })
  })

  describe("given an unterminated expression", () => {
    describe("when the value is read", () => {
      it("then returns undefined", () => {
        expect(soleExpression("{userName")).toBeUndefined()
      })
    })
  })
})
