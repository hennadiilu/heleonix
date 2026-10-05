import { TextDocument } from "vscode-languageserver-textdocument"
import type { MarkupContent } from "vscode-languageserver"
import { EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"
import { DefinitionIndex } from "../src/index/DefinitionIndex"
import { createEmptyContribution } from "../src/index/createEmptyContribution"
import { compositeKey } from "../src/index/compositeKey"
import { StylingLanguageService } from "../src/languages/styling/StylingLanguageService"
import type { ILanguageContext } from "../src/languages/ILanguageContext"

function index(): DefinitionIndex {
  const contribution = createEmptyContribution()

  contribution.references.dictionary = { Labels: ["primary", "title"] }
  contribution.references.config = { Layout: ["gap", "density"] }
  contribution.entryDocs.dictionary = { [compositeKey("Labels", "title")]: { summary: "The card title." } }

  return new DefinitionIndex([contribution])
}

function context(): ILanguageContext {
  return {
    index: index(),
    unknownReferenceSeverity: undefined,
    unusedEntrySeverity: undefined,
    converters: [],
    actions: [],
    components: [],
    themeTokens: new Map([["Colors.primary", "#0f62fe"]]),
    themeTokenLocations: new Map(),
    qualifiers: [],
    controlNames: new Map(),
  } as unknown as ILanguageContext
}

const style = new StylingLanguageService("style", EXT_STYLE)
const theme = new StylingLanguageService("theme", EXT_THEME)

function at(text: string, uri = "file:///Card.hxs"): { doc: TextDocument; offset: number } {
  const offset = text.indexOf("|")

  return { doc: TextDocument.create(uri, "hxs", 1, text.replace("|", "")), offset }
}

function labels(service: StylingLanguageService, text: string): string[] {
  const { doc, offset } = at(text)

  return service
    .completion(doc, doc.positionAt(offset), context())
    .map((item) => item.label)
    .sort()
}

function hoverText(text: string): string | undefined {
  const { doc, offset } = at(text)
  const hover = style.hover(doc, doc.positionAt(offset), context())

  return hover ? (hover.contents as MarkupContent).value : undefined
}

describe("StylingLanguageService dictionary and config references", () => {
  describe("completion", () => {
    it("then completes dictionary names after `{@` in a declaration value", () => {
      expect(labels(style, "content: {@|}")).toEqual(["Labels"])
    })

    it("then completes a dictionary's entries after the separator", () => {
      expect(labels(style, "content: {@Labels.|}")).toEqual(["primary", "title"])
    })

    it("then completes config names and entries after `{#`", () => {
      expect(labels(style, "gap: {#|}")).toEqual(["Layout"])
      expect(labels(style, "gap: {#Layout.de|}")).toEqual(["density", "gap"])
    })

    it("then completes inside a qualifier argument", () => {
      expect(labels(style, "@hx-if(value: {variant}, is: {@Labels.|}) {}")).toEqual(["primary", "title"])
    })

    it("then completes inside a media query, parenthesized or not", () => {
      expect(labels(style, "@media (max-width: {#Layout.|}) {}")).toEqual(["density", "gap"])
      expect(labels(style, "@media {@|} {}")).toEqual(["Labels"])
    })

    it("then completes inside a quoted value", () => {
      expect(labels(style, "content: '{@|}';")).toEqual(["Labels"])
    })

    it("then offers nothing for a bare `@` or `#`, which begin an at-rule or a hex color", () => {
      expect(labels(style, "@me|")).toEqual([])
      expect(labels(style, "color: #ff|")).toEqual([])
    })

    it("then offers nothing inside a same-line block body", () => {
      expect(labels(style, ":hover { @h|")).toEqual([])
    })

    it("then replaces only the typed segment", () => {
      const { doc, offset } = at("content: {@Labels.ti|}")
      const item = style.completion(doc, doc.positionAt(offset), context()).find((i) => i.label === "title")!
      const edit = item.textEdit as { range: { start: { character: number }; end: { character: number } } }

      expect(doc.getText().slice(edit.range.start.character, edit.range.end.character)).toBe("ti")
    })

    it("then still completes theme tokens", () => {
      expect(labels(style, "color: {$|}")).toEqual(["Colors"])
    })

    it("then registers `@` and `#` as trigger characters for styles", () => {
      expect(style.completionTriggerCharacters).toEqual(jasmine.arrayContaining(["@", "#"]))
    })
  })

  describe("themes", () => {
    it("then do not offer dictionary or config references, which a theme cannot use", () => {
      expect(labels(theme, "primary: {@|}")).toEqual([])
      expect(theme.completionTriggerCharacters).not.toContain("#")
    })
  })

  describe("hover", () => {
    it("then shows a dictionary entry's docs over its reference", () => {
      expect(hoverText("content: {@Labels.ti|tle};")).toContain("The card title.")
    })

    it("then covers references in qualifier arguments", () => {
      expect(hoverText("@hx-if(value: {v}, is: {@Labels.ti|tle}) {}")).toContain("@Labels.title")
    })

    it("then shows nothing for a commented-out reference", () => {
      expect(hoverText("/* {@Labels.ti|tle} */")).toBeUndefined()
    })
  })
})
