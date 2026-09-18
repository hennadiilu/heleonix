import { scanXml } from "@heleonix/hx-compiler-core"

function attrs(source: string) {
  return scanXml(source).tags[0].attrs
}

describe("scanXml", () => {
  describe("given a quoted attribute value", () => {
    describe("when the tag is scanned", () => {
      it("then reads it as a literal, in either quote style", () => {
        expect(attrs(`<Button variant="primary" />`)[0]).toEqual(
          jasmine.objectContaining({ name: "variant", kind: "literal", value: "primary" }),
        )
        expect(attrs(`<Button variant='primary' />`)[0]).toEqual(
          jasmine.objectContaining({ name: "variant", kind: "literal", value: "primary" }),
        )
      })
    })
  })

  describe("given a braced attribute value", () => {
    describe("when the tag is scanned", () => {
      it("then reads it as an expression holding the source text between the braces", () => {
        expect(attrs(`<Button value={userName} />`)[0]).toEqual(
          jasmine.objectContaining({ name: "value", kind: "expression", value: "userName" }),
        )
      })

      it("then bounds the value by the braces, so a range selects the expression alone", () => {
        const source = `<Button value={userName} />`
        const attr = attrs(source)[0]

        expect(source.slice(attr.valueStart, attr.valueEnd)).toBe("userName")
      })
    })
  })

  describe("given a value-less attribute", () => {
    describe("when the tag is scanned", () => {
      it("then reads it as a flag and does not swallow what follows", () => {
        const parsed = attrs(`<Button isVisible variant="primary" />`)

        expect(parsed[0]).toEqual(jasmine.objectContaining({ name: "isVisible", kind: "flag" }))
        expect(parsed[0].value).toBeUndefined()
        expect(parsed[1]).toEqual(jasmine.objectContaining({ name: "variant", kind: "literal", value: "primary" }))
      })

      it("then still ends the tag on the flag", () => {
        expect(scanXml(`<Button isVisible />`).tags[0].selfClosing).toBeTrue()
      })
    })
  })

  describe("given the brace short form", () => {
    describe("when the tag is scanned", () => {
      it("then names the attribute after the expression's leading path", () => {
        expect(attrs(`<Button {userName} />`)[0]).toEqual(
          jasmine.objectContaining({ name: "userName", kind: "expression", shorthand: true, value: "userName" }),
        )
      })

      it("then keeps the name when the expression carries converters", () => {
        const attr = attrs(`<Button {userName | Truncate(length: 40)} />`)[0]

        expect(attr.name).toBe("userName")
        expect(attr.value).toBe("userName | Truncate(length: 40)")
      })

      it("then points the name offsets at the identifier inside the braces", () => {
        const source = `<Button {userName} />`
        const attr = attrs(source)[0]

        expect(source.slice(attr.nameStart, attr.nameEnd)).toBe("userName")
      })
    })
  })

  describe("given a braced value containing tag-ending characters", () => {
    describe("when the tag is scanned", () => {
      it("then does not close the tag inside the expression", () => {
        const attr = attrs(`<Button title={a | Pick(fallback: 'a > b / c')} />`)[0]

        expect(attr.value).toBe("a | Pick(fallback: 'a > b / c')")
      })

      it("then tracks nested braces", () => {
        expect(attrs(`<Button title={a | Pick(fallback: '{x}')} />`)[0].value).toBe("a | Pick(fallback: '{x}')")
      })
    })
  })

  describe("given an unterminated braced value", () => {
    describe("when the tag is scanned", () => {
      it("then reports it rather than throwing", () => {
        expect(attrs(`<Button value={userName`)[0].unterminated).toBeTrue()
      })
    })
  })

  describe("given an assignment with neither a quoted nor a braced value", () => {
    describe("when the tag is scanned", () => {
      it("then marks the attribute malformed", () => {
        expect(attrs(`<Button value=userName />`)[0].malformed).toBeTrue()
      })
    })
  })
})
