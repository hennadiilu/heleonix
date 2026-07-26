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

  describe("given a props key referencing a named type", () => {
    const source = `---
props: ButtonProps
---
<Component />`

    describe("when the source is split", () => {
      it("then captures the raw type name under types, not frontmatter", () => {
        const result = splitFrontmatter(source)

        expect(result.types).toEqual({ props: "ButtonProps" })
        expect(result.frontmatter["props"]).toBeUndefined()
        expect(result.body).toBe("<Component />")
      })
    })
  })

  describe("given props and events with multi-line inline type literals", () => {
    const source = `---
props: {
  /** doc with a } brace and "string }" inside */
  variant?: 'primary' | 'secondary'
  nested: { a: number; b: string }
}
events: RowEvents
---
<Component />`

    describe("when the source is split", () => {
      it("then captures each brace-balanced type verbatim and the body after", () => {
        const result = splitFrontmatter(source)

        expect(result.types!["props"]).toContain("variant?: 'primary' | 'secondary'")
        expect(result.types!["props"]).toContain("nested: { a: number; b: string }")
        expect(result.types!["props"].startsWith("{")).toBeTrue()
        expect(result.types!["props"].endsWith("}")).toBeTrue()
        expect(result.types!["events"]).toBe("RowEvents")
        expect(result.body).toBe("<Component />")
      })
    })
  })

  describe("given top-level entries with comments", () => {
    const source = `---
usage: extend // trailing comment
/* plain block comment */
other: 'raw value'
---
{ "key": "value" }`

    describe("when the source is split", () => {
      it("then returns raw values without unquoting and the body after the fence", () => {
        const result = splitFrontmatter(source)

        expect(result.frontmatter).toEqual({ usage: "extend", other: "'raw value'" })
        expect(result.body).toBe(`{ "key": "value" }`)
      })
    })
  })

  describe("given a detached summary, a documented block and a documented block entry", () => {
    const source = `---
/**
 * Renders a data table.
 */

/** A group of prop typings. */
props {
  /** Visual emphasis. */
  variant: %ButtonVariants = %primary
  fullWidth: boolean = false
}
---
<Component />`

    describe("when the source is split", () => {
      it("then returns the summary, the block docs, the entries and the entry docs", () => {
        const result = splitFrontmatter(source)

        expect(result.docs).toContain("Renders a data table.")
        expect(result.blocks!["props"].docs).toBe("* A group of prop typings. ")
        expect(result.blocks!["props"].entries["variant"]).toEqual({
          value: "%ButtonVariants = %primary",
          docs: "* Visual emphasis. ",
        })
        expect(result.blocks!["props"].entries["fullWidth"]).toEqual({ value: "boolean = false" })
      })
    })
  })

  describe("given a nested block", () => {
    const source = `---
props {
  sub {
}
---
body`

    describe("when the source is split", () => {
      it("then throws the nested-block error", () => {
        expect(() => splitFrontmatter(source)).toThrowMatching(
          (error) => (error as { code?: string }).code === "HX_COMPILER_0072",
        )
      })
    })
  })

  describe("given an unterminated block", () => {
    const source = `---
props {
  variant: boolean
---
body`

    describe("when the source is split", () => {
      it("then throws the unterminated-block error", () => {
        expect(() => splitFrontmatter(source)).toThrowMatching(
          (error) => (error as { code?: string }).code === "HX_COMPILER_0073",
        )
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
