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

  describe("given the attribute forms of a component usage", () => {
    async function usage(attributes: string) {
      const result = await new ComponentCompiler().compile(
        `<Component><Button ${attributes} /></Component>`,
        {},
        { name: "Form" },
      )

      return result.children![0]
    }

    describe("when a value is quoted static text", () => {
      it("then binds it as a string literal, in either quote style", async () => {
        expect((await usage(`variant="primary"`)).properties).toEqual([
          { name: "variant", binding: { type: "literal", value: '"primary"' } },
        ])
        expect((await usage(`variant='primary'`)).properties).toEqual([
          { name: "variant", binding: { type: "literal", value: '"primary"' } },
        ])
      })
    })

    describe("when an attribute carries no value", () => {
      it("then binds it as the boolean literal true", async () => {
        expect((await usage("isVisible")).properties).toEqual([
          { name: "isVisible", binding: { type: "literal", value: "true" } },
        ])
      })
    })

    describe("when a value is braced", () => {
      it("then parses it against the binding grammar", async () => {
        expect((await usage("value={userName}")).properties).toEqual([
          { name: "value", binding: { type: "state", value: "userName" } },
        ])
        expect((await usage("label={@Buttons.save}")).properties).toEqual([
          { name: "label", binding: { type: "dictionary", value: "Buttons.save" } },
        ])
        expect((await usage("maxWidth={12.3}")).properties).toEqual([
          { name: "maxWidth", binding: { type: "literal", value: "12.3" } },
        ])
      })

      it("then reads a quoted source as a literal and a bare one as state, so a chain is unambiguous", async () => {
        expect((await usage("shape={'circle' | Pick}")).properties).toEqual([
          { name: "shape", binding: { type: "literal", value: '"circle"', converters: ["Pick"] } },
        ])
        expect((await usage("shape={circle | Pick}")).properties).toEqual([
          { name: "shape", binding: { type: "state", value: "circle", converters: ["Pick"] } },
        ])
      })
    })

    describe("when the brace short form is used", () => {
      it("then binds the property of that name to the state of the same name", async () => {
        expect((await usage("{userName}")).properties).toEqual([
          { name: "userName", binding: { type: "state", value: "userName" } },
        ])
      })

      it("then keeps the property name when the expression carries converters", async () => {
        expect((await usage("{userName | Truncate}")).properties).toEqual([
          { name: "userName", binding: { type: "state", value: "userName", converters: ["Truncate"] } },
        ])
      })
    })

    describe("when the name attribute is bound rather than written as static text", () => {
      it("then rejects it - a usage name is a compile-time identifier", async () => {
        await expectAsync(
          new ComponentCompiler().compile(`<Component><Button name={x} /></Component>`, {}, { name: "Form" }),
        ).toBeRejectedWith(jasmine.objectContaining({ code: "HX_COMPILER_0409" }))
      })
    })

    describe("when a braced value is not a valid expression", () => {
      it("then reports the invalid binding", async () => {
        await expectAsync(usage("value={not a binding}")).toBeRejectedWith(
          jasmine.objectContaining({ code: "HX_COMPILER_0400" }),
        )
      })
    })
  })

  describe("given element text", () => {
    async function content(text: string) {
      const result = await new ComponentCompiler().compile(
        `<Component><span>${text}</span></Component>`,
        {},
        { name: "Form" },
      )

      return result.children![0].children![0].properties![0].binding
    }

    describe("when the text is static", () => {
      it("then binds it as a string literal", async () => {
        expect(await content("Save changes")).toEqual({ type: "literal", value: '"Save changes"' })
      })
    })

    describe("when the text is one braced expression", () => {
      it("then binds the expression it holds", async () => {
        expect(await content("{@Buttons.save}")).toEqual({ type: "dictionary", value: "Buttons.save" })
      })
    })
  })

  describe("given a component override", () => {
    async function override(attribute: string) {
      const result = await new ComponentCompiler().compile(
        `<Component><Button ${attribute} /></Component>`,
        {},
        { name: "Form" },
      )

      return result.children![0].overrides
    }

    describe("when the value is quoted static text", () => {
      it("then names the replacement component directly", async () => {
        expect(await override(`add:Component="CustomAddButton"`)).toEqual([
          { target: "add", binding: { type: "literal", value: '"CustomAddButton"' } },
        ])
      })
    })

    describe("when the value is a braced reference", () => {
      it("then resolves the name through the referenced entry", async () => {
        expect(await override("add:Component={@Components.CustomAddButton}")).toEqual([
          { target: "add", binding: { type: "dictionary", value: "Components.CustomAddButton" } },
        ])
      })
    })

    describe("when the value is empty", () => {
      it("then leaves the target rendering nothing", async () => {
        expect(await override(`add:Component=""`)).toEqual([{ target: "add" }])
      })
    })
  })
})
