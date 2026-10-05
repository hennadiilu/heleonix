import { TextDocument } from "vscode-languageserver-textdocument"
import { EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import { DefinitionIndex } from "../src/index/DefinitionIndex"
import { StylingLanguageService } from "../src/languages/styling/StylingLanguageService"
import type { ILanguageContext } from "../src/languages/ILanguageContext"

const components: IComponentInfo[] = [
  {
    name: "Card",
    open: false,
    members: [
      { name: "size", optional: false, kind: "number", isFunction: false, docs: "The card size in px." },
      { name: "label", optional: true, kind: "string", isFunction: false },
    ],
  },
  { name: "Other", open: false, members: [{ name: "unrelated", optional: false, kind: "string", isFunction: false }] },
]

function context(): ILanguageContext {
  return {
    index: new DefinitionIndex([]),
    unknownReferenceSeverity: undefined,
    unusedEntrySeverity: undefined,
    converters: [],
    actions: [],
    components,
    themeTokens: new Map([["Colors.primary", "#0f62fe"]]),
    themeTokenLocations: new Map(),
    qualifiers: [],
    controlNames: new Map(),
  } as unknown as ILanguageContext
}

function labels(text: string, service = new StylingLanguageService("style", EXT_STYLE), uri = "file:///Card.hxs") {
  const offset = text.indexOf("|")
  const doc = TextDocument.create(uri, "hxs", 1, text.replace("|", ""))

  return service
    .completion(doc, doc.positionAt(offset), context())
    .map((item) => item.label)
    .sort()
}

describe("StylingLanguageService property completion", () => {
  describe("in a declaration value", () => {
    it("then completes the styled component's own properties right after `{`", () => {
      expect(labels("width: {|}")).toEqual(["label", "size"])
    })

    it("then completes a partially typed property", () => {
      expect(labels("width: {si|}px")).toEqual(["label", "size"])
    })

    it("then completes after earlier interpolations on the same line", () => {
      expect(labels("margin: {$Colors.primary} {size}px {|}")).toEqual(["label", "size"])
    })

    it("then completes inside a function and inside a quoted string", () => {
      expect(labels("width: calc({|} * 2)")).toEqual(["label", "size"])
      expect(labels("content: 'Hi, {|}'")).toEqual(["label", "size"])
    })

    it("then completes in a declaration nested in a block on the same line", () => {
      expect(labels(":hover { width: {|} }")).toEqual(["label", "size"])
    })

    it("then resolves the component from a dimensioned style file name", () => {
      expect(labels("width: {|}", undefined, "file:///Card.dark.hxs")).toEqual(["label", "size"])
    })

    it("then documents each property", () => {
      const doc = TextDocument.create("file:///Card.hxs", "hxs", 1, "width: {}")
      const item = new StylingLanguageService("style", EXT_STYLE)
        .completion(doc, doc.positionAt(8), context())
        .find((i) => i.label === "size")!

      expect(item.documentation).toEqual(jasmine.objectContaining({ value: "The card size in px." }))
    })
  })

  describe("in a media query", () => {
    it("then completes properties inside the query's parentheses", () => {
      expect(labels("@media (max-width: {|}px) { color: red; }")).toEqual(["label", "size"])
      expect(labels("@media (max-width: 1px) and (min-width: {si|})")).toEqual(["label", "size"])
    })

    it("then completes in a media query nested in a block", () => {
      expect(labels(":hover { @media (max-width: {|}) {} }")).toEqual(["label", "size"])
    })

    it("then offers nothing at the query's block brace, which is not a source", () => {
      expect(labels("@media (max-width: 1px) {|}")).toEqual([])
      expect(labels("@media {|}")).toEqual([])
    })
  })

  describe("outside a declaration value", () => {
    it("then offers nothing at a block's opening brace", () => {
      expect(labels(":hover {|}")).toEqual([])
      expect(labels("@media (max-width: 1px) {|}")).toEqual([])
    })

    it("then leaves dictionary, config and theme sources to their own completion", () => {
      expect(labels("width: {$|}")).toEqual(["Colors"])
      expect(labels("width: {@|}")).toEqual([])
    })

    it("then offers nothing past a converter pipe or a dotted path", () => {
      expect(labels("width: {size | f|}")).toEqual([])
      expect(labels("width: {size.x|}")).toEqual([])
    })

    it("then offers nothing in a theme, which has no component", () => {
      expect(labels("primary: {|}", new StylingLanguageService("theme", EXT_THEME), "file:///Card.hxt")).toEqual([])
    })
  })
})
