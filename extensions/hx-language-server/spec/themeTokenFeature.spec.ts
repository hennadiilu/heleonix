import { pathToFileURL } from "node:url"
import { TextDocument } from "vscode-languageserver-textdocument"
import { CompletionItemKind, MarkupContent } from "vscode-languageserver"
import type { IThemeTokenLocation } from "@heleonix/hx-analyzer"
import {
  completeThemeToken,
  hoverThemeToken,
  definitionThemeToken,
} from "../src/languages/styling/themeTokenFeature.ts"

const tokens = new Map<string, string>([
  ["Palette.Blue.t60", "#0f62fe"],
  ["Palette.Neutral.t90", "#18181b"],
  ["Colors.Text.default", "{$Palette.Neutral.t90}"],
  ["Spacing.xs", "4px"],
])

/** Builds a document from text where `|` marks the cursor; returns the doc and cursor offset. */
function at(text: string): { doc: TextDocument; offset: number } {
  const offset = text.indexOf("|")

  return { doc: TextDocument.create("file:///x.hxs", "hxs", 1, text.replace("|", "")), offset }
}

function complete(text: string) {
  const { doc, offset } = at(text)

  return completeThemeToken(doc, offset, tokens)
}

function hover(text: string): string | undefined {
  const { doc, offset } = at(text)
  const result = hoverThemeToken(doc, offset, tokens)

  return result ? (result.contents as MarkupContent).value : undefined
}

describe("completeThemeToken", () => {
  it("then offers the top-level group segments right after `{$`", () => {
    const items = complete("color: {$|")!

    expect(items.map((i) => i.label).sort()).toEqual(["Colors", "Palette", "Spacing"])
    expect(items.every((i) => i.kind === CompletionItemKind.Module)).toBeTrue()
  })

  it("then offers the next segment after a `.`", () => {
    expect(
      complete("color: {$Palette.|")!
        .map((i) => i.label)
        .sort(),
    ).toEqual(["Blue", "Neutral"])
  })

  it("then offers leaf tokens with their value as detail", () => {
    const items = complete("padding: {$Spacing.|")!

    expect(items).toEqual([jasmine.objectContaining({ label: "xs", kind: CompletionItemKind.Field, detail: "4px" })])
  })

  it("then replaces the partial segment being typed", () => {
    const { doc, offset } = at("color: {$Pal|")
    const items = completeThemeToken(doc, offset, tokens)!
    const palette = items.find((i) => i.label === "Palette")!

    expect(palette.textEdit).toEqual(
      jasmine.objectContaining({ range: jasmine.objectContaining({ start: doc.positionAt(offset - 3) }) }),
    )
  })

  it("then returns undefined outside a `{$...}` reference", () => {
    expect(complete("color: red|")).toBeUndefined()
  })
})

describe("hoverThemeToken", () => {
  it("then shows a token's value", () => {
    expect(hover("padding: {$Spacing.x|s};")).toContain("4px")
  })

  it("then resolves an alias chain to its terminal value", () => {
    const contents = hover("color: {$Colors.Text.def|ault};")!

    expect(contents).toContain("#18181b")
    expect(contents).toContain("Colors.Text.default → Palette.Neutral.t90")
  })

  it("then returns null off any token", () => {
    expect(hover("color: re|d;")).toBeUndefined()
  })
})

const locations = new Map<string, IThemeTokenLocation>([
  ["Palette.Blue.t60", { file: "C:/proj/Primitives.hxt", line: 3, character: 4, length: 3 }],
])

function definition(text: string) {
  const { doc, offset } = at(text)

  return definitionThemeToken(doc, offset, locations)
}

describe("definitionThemeToken", () => {
  it("then resolves a token to its declaration location as a file URI and range", () => {
    expect(definition("color: {$Palette.Blue.t|60};")).toEqual({
      uri: pathToFileURL("C:/proj/Primitives.hxt").toString(),
      range: { start: { line: 3, character: 4 }, end: { line: 3, character: 7 } },
    })
  })

  it("then returns null for a token with no known location", () => {
    expect(definition("color: {$Spacing.x|s};")).toBeNull()
  })

  it("then returns null off any token", () => {
    expect(definition("color: re|d;")).toBeNull()
  })
})
