import { ComponentCompiler } from "@heleonix/hx-compiler-components"

describe("ComponentCompiler", () => {
  describe("given a template with a typings frontmatter", () => {
    const source = `---
/**
 * Greets the current user.
 */

props: {
  /** Visual emphasis. @default 'default' */
  variant?: 'primary' | 'default'
}
events: GreetingEvents
---
<Component>
  <div>userName</div>
</Component>`

    describe("when the source is compiled", () => {
      it("then strips the header and compiles the template body", async () => {
        const result = await new ComponentCompiler().compile(source, {}, { name: "Greeting" })

        expect(result.tag).toBe("Greeting")
        expect(result.children!.length).toBe(1)
        expect(result.children![0].tag).toBe("div")
      })
    })

    describe("when the header is compiled", () => {
      it("then returns the summary and the raw TypeScript type text of props and events", () => {
        const result = new ComponentCompiler().compileHeader(source)!

        expect(result.docs).toContain("Greets the current user.")
        expect(result.props).toContain("variant?: 'primary' | 'default'")
        expect(result.props!.startsWith("{")).toBeTrue()
        expect(result.events).toBe("GreetingEvents")
      })
    })

    describe("when the docs are compiled", () => {
      it("then returns the component summary", () => {
        const result = new ComponentCompiler().compileDocs(source, {}, { name: "Greeting" })!

        expect(result.docs.summary).toBe("Greets the current user.")
      })
    })
  })

  describe("given a root with no children", () => {
    describe("when the source is compiled", () => {
      it("then throws the empty-root error - '.hxm' components are always declarative", async () => {
        await expectAsync(new ComponentCompiler().compile(`<Component />`, {}, { name: "X" })).toBeRejectedWith(
          jasmine.objectContaining({ code: "HX_COMPILER_0408" }),
        )
      })
    })
  })
})
