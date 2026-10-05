import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { pathToFileURL } from "node:url"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"
import { DefinitionRegistry } from "../src/sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "../src/sources/WorkspaceDefinitionSource"
import { DictionaryLanguageService } from "../src/languages/dictionary/DictionaryLanguageService"
import type { ILanguageContext } from "../src/languages/ILanguageContext"

const LABELS = `{ "title": "Title", "unused": "Never referenced" }`
const LAYOUT = `{ "gap": "8px" }`
const CARD_STYLE = `/* {@Labels.unused} */\ncontent: '{@Labels.title}';\n@hx-if(value: {gap}, is: {#Layout.gap}) { color: red; }\n`

describe("style references in the workspace index", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-style-index-"))
  const labelsPath = path.join(root, "Labels.hxd")
  const layoutPath = path.join(root, "Layout.hxc")
  const stylePath = path.join(root, "Card.hxs")

  beforeAll(() => {
    fs.writeFileSync(labelsPath, LABELS)
    fs.writeFileSync(layoutPath, LAYOUT)
    fs.writeFileSync(stylePath, CARD_STYLE)
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  async function registry(): Promise<DefinitionRegistry> {
    const result = new DefinitionRegistry()

    result.register(new WorkspaceDefinitionSource([root], new Set()))
    await result.rebuild()

    return result
  }

  it("then counts an entry used only from a style as used, with the style's component as its referrer", async () => {
    const index = (await registry()).getIndex()

    expect(index.isEntryUsed("dictionary", "Labels", "title")).toBeTrue()
    expect(index.isEntryUsed("config", "Layout", "gap")).toBeTrue()
    expect(index.entryReferrers("dictionary", "Labels", "title")).toEqual(["Card"])
  })

  it("then still reports an entry referenced only from a style comment as unused", async () => {
    const index = (await registry()).getIndex()
    const doc = TextDocument.create(pathToFileURL(labelsPath).href, "hxd", 1, LABELS)
    const context = { index, unknownReferenceSeverity: undefined, unusedEntrySeverity: DiagnosticSeverity.Information }

    const messages = new DictionaryLanguageService()
      .diagnostics(doc, context as unknown as ILanguageContext)
      .map((d) => d.message)

    expect(messages).toEqual([jasmine.stringContaining("'unused'")])
  })

  it("then goes from a style reference to the entry's definition", async () => {
    const occurrences = (await registry()).getOccurrences()
    const [location] = occurrences.definitionsAt(stylePath, CARD_STYLE.indexOf("@Labels.title") + 3)

    expect(location.uri).toBe(pathToFileURL(labelsPath).href)
    expect(location.range.start).toEqual({ line: 0, character: LABELS.indexOf('"title"') })
  })

  it("then finds style references from the entry's definition", async () => {
    const occurrences = (await registry()).getOccurrences()
    const references = occurrences.referencesAt(layoutPath, LAYOUT.indexOf("gap"), false)

    expect(references.map((r) => r.uri)).toEqual([pathToFileURL(stylePath).href])
  })

  it("then re-indexes a style edited in memory", async () => {
    const result = await registry()

    await result.updateFile(stylePath, "color: {@Labels.unused};")

    expect(result.getIndex().isEntryUsed("dictionary", "Labels", "unused")).toBeTrue()
    expect(result.getIndex().isEntryUsed("dictionary", "Labels", "title")).toBeFalse()
  })
})

describe("style references in analyzer diagnostics", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-style-diagnostics-"))
  const source = `content: '{@Labels.missing}';\n@hx-if(value: {gap}, is: {#Layout.nope}) { color: red; }\n`
  const stylePath = path.join(root, "Card.hxs")

  beforeAll(() => {
    fs.writeFileSync(path.join(root, "Labels.hxd"), LABELS)
    fs.writeFileSync(path.join(root, "Layout.hxc"), LAYOUT)
    fs.writeFileSync(stylePath, source)
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it("then reports unknown dictionary and config references at their text", async () => {
    const host = new AnalyzerHost()

    host.seed([root], new Set())

    const document = TextDocument.create(pathToFileURL(stylePath).href, "heleonix-hx-style", 1, source)
    const subjects = (await host.diagnosticsFor(stylePath, document)).map((d) =>
      source.slice(document.offsetAt(d.range.start), document.offsetAt(d.range.end)),
    )

    expect(subjects.sort()).toEqual(["#Layout.nope", "@Labels.missing"])
  })
})
