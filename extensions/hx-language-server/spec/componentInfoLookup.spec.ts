import type { IComponentInfo } from "@heleonix/hx-analyzer"
import {
  byName,
  componentDocs,
  componentSummary,
  memberOf,
  memberSummary,
  memberType,
} from "../src/languages/component/componentInfoLookup"

const button: IComponentInfo = {
  name: "button",
  open: true,
  docs: "* The button element represents a clickable button. ",
  members: [
    { name: "type", optional: true, kind: "enum", enumValues: ["button", "submit", "reset"], isFunction: false },
    { name: "disabled", optional: true, kind: "boolean", isFunction: false },
    { name: "id", optional: true, kind: "unknown", isFunction: false, docs: "A unique identifier." },
  ],
}

const greeting: IComponentInfo = {
  name: "Greeting",
  open: false,
  members: [
    {
      name: "variant",
      optional: true,
      kind: "enum",
      enumValues: ["primary", "secondary"],
      isFunction: false,
      docs: "Visual emphasis.",
    },
  ],
}

describe("componentInfoLookup", () => {
  describe("given the analyzer's component contracts", () => {
    const index = byName([button, greeting])

    describe("when a member is looked up on a tag", () => {
      it("then resolves the member", () => {
        expect(memberOf(index, "button", "type")?.kind).toBe("enum")
        expect(memberOf(index, "button", "missing")).toBeUndefined()
      })
    })

    describe("when a component's summary is read from its raw doc comment", () => {
      it("then strips the doc-comment convention to prose", () => {
        expect(componentSummary(button)).toBe("The button element represents a clickable button.")
        expect(componentDocs(button)?.summary).toBe("The button element represents a clickable button.")
        expect(componentSummary(greeting)).toBeUndefined()
      })
    })

    describe("when a member's type is rendered for display", () => {
      it("then shows an enum union or the bare kind", () => {
        expect(memberType(button.members[0])).toBe("'button' | 'submit' | 'reset'")
        expect(memberType(button.members[1])).toBe("boolean")
        expect(memberType(button.members[2])).toBe("unknown")
      })
    })

    describe("when a member's summary is read", () => {
      it("then returns its documented prose, or undefined when undocumented", () => {
        expect(memberSummary(memberOf(index, "button", "id"))).toBe("A unique identifier.")
        expect(memberSummary(memberOf(index, "button", "type"))).toBeUndefined()
        expect(memberSummary(memberOf(index, "Greeting", "variant"))).toBe("Visual emphasis.")
      })
    })
  })
})
