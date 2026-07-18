import { splitFrontmatter } from "@heleonix/hx-compiler-core"

describe("splitFrontmatter", () => {
  describe("given a source without a frontmatter header", () => {
    const source = `{ "key": "value" }`

    describe("when the source is split", () => {
      it("then returns an empty header and the whole source as the body", () => {
        const result = splitFrontmatter(source)

        expect(result.frontmatter).toEqual({})
        expect(result.body).toBe(source)
      })
    })
  })

  describe("given a header with entries, blank lines and comments", () => {
    const source = `---
usage: extend

# a comment
other: value
---
{ "key": "value" }`

    describe("when the source is split", () => {
      it("then returns the parsed entries and the body after the closing fence", () => {
        const result = splitFrontmatter(source)

        expect(result.frontmatter).toEqual({ usage: "extend", other: "value" })
        expect(result.body).toBe(`{ "key": "value" }`)
      })
    })
  })

  describe("given a header entry with a quoted value", () => {
    const source = `---
usage: "extend"
---
body`

    describe("when the source is split", () => {
      it("then returns the value without the wrapping quotes", () => {
        const result = splitFrontmatter(source)

        expect(result.frontmatter["usage"]).toBe("extend")
      })
    })
  })

  describe("given an opening fence without a closing fence", () => {
    const source = `---
usage: extend
{ "key": "value" }`

    describe("when the source is split", () => {
      it("then throws the unterminated frontmatter error", () => {
        expect(() => splitFrontmatter(source)).toThrowMatching(
          (error) => (error as { code?: string }).code === "HX_COMPILER_0070",
        )
      })
    })
  })

  describe("given a header entry without a colon separator", () => {
    const source = `---
invalid entry
---
body`

    describe("when the source is split", () => {
      it("then throws the invalid entry error", () => {
        expect(() => splitFrontmatter(source)).toThrowMatching(
          (error) => (error as { code?: string }).code === "HX_COMPILER_0071",
        )
      })
    })
  })
})
