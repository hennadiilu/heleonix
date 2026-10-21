import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Location } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionRegistry } from "../src/sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "../src/sources/WorkspaceDefinitionSource"

const PRIMITIVES = [
  "/** Raw palette. */",
  "Palette {",
  "  Neutral { t90: #18181b; }",
  "  Blue { t60: #0f62fe; }",
  "}",
  "Motion { fade: 0.5; }",
  "@keyframes pulse { to { opacity: {$Motion.fade}; } }",
  "",
].join("\n")
const SEMANTIC = [
  "---",
  "usage: extend",
  "---",
  "Colors { Text { default: {$Palette.Neutral.t90}; } }",
  "Type { Body { font-size: 14px; } }",
  "",
].join("\n")
const OVERLAY = "Colors { Text { default: #000; } }\n"
const CARD_STYLE = "// {$Colors.Text.default}\ncolor: {$Colors.Text.default};\n@hx-apply(token: Type.Body);\n"

describe("theme token references in the workspace index", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-theme-index-"))
  const primitivesPath = path.join(root, "Primitives.hxt")
  const semanticPath = path.join(root, "Semantic.hxt")
  const overlayPath = path.join(root, "Semantic.customer2.hxt")
  const stylePath = path.join(root, "Card.hxs")

  beforeAll(() => {
    fs.writeFileSync(primitivesPath, PRIMITIVES)
    fs.writeFileSync(semanticPath, SEMANTIC)
    fs.writeFileSync(overlayPath, OVERLAY)
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

  function span(filePath: string, source: string, start: number, length: number): Location {
    const doc = TextDocument.create("file:///span", "hxt", 1, source)

    return Location.create(pathToFileURL(filePath).href, {
      start: doc.positionAt(start),
      end: doc.positionAt(start + length),
    })
  }

  const styleUsage = CARD_STYLE.lastIndexOf("$Colors.Text.default")

  it("then goes from a style usage to every partial defining the token", async () => {
    const definitions = (await registry()).getOccurrences().definitionsAt(stylePath, styleUsage + 9)

    expect(definitions).toEqual(
      jasmine.arrayWithExactContents([
        span(semanticPath, SEMANTIC, SEMANTIC.indexOf("default"), "default".length),
        span(overlayPath, OVERLAY, OVERLAY.indexOf("default"), "default".length),
      ]),
    )
  })

  it("then finds a token's usages from its definition, skipping comments", async () => {
    const occurrences = (await registry()).getOccurrences()

    expect(occurrences.referencesAt(overlayPath, OVERLAY.indexOf("default"), false)).toEqual([
      span(stylePath, CARD_STYLE, styleUsage, "$Colors.Text.default".length),
    ])
  })

  it("then includes every partial's definition when asked for declarations", async () => {
    const uris = (await registry())
      .getOccurrences()
      .referencesAt(semanticPath, SEMANTIC.indexOf("default"), true)
      .map((location) => location.uri)

    expect(uris).toEqual(
      jasmine.arrayWithExactContents([semanticPath, overlayPath, stylePath].map((file) => pathToFileURL(file).href)),
    )
  })

  it("then links a theme alias to the aliased token both ways", async () => {
    const occurrences = (await registry()).getOccurrences()
    const alias = SEMANTIC.indexOf("$Palette.Neutral.t90")

    expect(occurrences.definitionsAt(semanticPath, alias + 1)).toEqual([
      span(primitivesPath, PRIMITIVES, PRIMITIVES.indexOf("t90"), "t90".length),
    ])
    expect(occurrences.referencesAt(primitivesPath, PRIMITIVES.indexOf("t90"), false)).toEqual([
      span(semanticPath, SEMANTIC, alias, "$Palette.Neutral.t90".length),
    ])
  })

  it("then resolves `@hx-apply` to the group it expands and lists it among the group's usages", async () => {
    const occurrences = (await registry()).getOccurrences()
    const apply = CARD_STYLE.indexOf("Type.Body")
    const group = SEMANTIC.indexOf("Body")

    expect(occurrences.definitionsAt(stylePath, apply)).toEqual([span(semanticPath, SEMANTIC, group, "Body".length)])
    expect(occurrences.referencesAt(semanticPath, group, false)).toEqual([
      span(stylePath, CARD_STYLE, apply, "Type.Body".length),
    ])
  })

  it("then defines no token for an `@`-artifact while its values still reference tokens", async () => {
    const occurrences = (await registry()).getOccurrences()

    expect(occurrences.definitionsAt(primitivesPath, PRIMITIVES.indexOf("pulse"))).toEqual([])
    expect(occurrences.definitionsAt(primitivesPath, PRIMITIVES.indexOf("$Motion.fade"))).toEqual([
      span(primitivesPath, PRIMITIVES, PRIMITIVES.indexOf("fade"), "fade".length),
    ])
  })

  it("then re-indexes a theme edited in memory", async () => {
    const result = await registry()

    await result.updateFile(semanticPath, SEMANTIC.replace("default", "muted"))

    expect(result.getOccurrences().definitionsAt(stylePath, styleUsage + 9)).toEqual([
      span(overlayPath, OVERLAY, OVERLAY.indexOf("default"), "default".length),
    ])
  })
})
