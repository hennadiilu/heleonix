import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { TextDocument } from "vscode-languageserver-textdocument"
import type { MarkupContent } from "vscode-languageserver"
import { EXT_STYLE } from "@heleonix/hx-language"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import { AnalyzerHost } from "../src/analysis/AnalyzerHost"
import { DefinitionIndex } from "../src/index/DefinitionIndex"
import { StylingLanguageService } from "../src/languages/styling/StylingLanguageService"
import type { ILanguageContext } from "../src/languages/ILanguageContext"

const components: IComponentInfo[] = [
  {
    name: "Card",
    open: false,
    members: [
      { name: "isSaving", optional: false, kind: "boolean", isFunction: false },
      { name: "variant", optional: true, kind: "string", isFunction: false },
    ],
  },
]

describe("built-in qualifier contracts from hx-core's hx.meta.json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-builtin-qualifiers-"))
  let context: ILanguageContext

  beforeAll(() => {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "app", dependencies: { "@heleonix/hx-core": "*" } }),
    )
    fs.mkdirSync(path.join(root, "node_modules", "@heleonix"), { recursive: true })
    fs.symlinkSync(
      path.resolve(process.cwd(), "../../runtime/hx-core"),
      path.join(root, "node_modules", "@heleonix", "hx-core"),
      "junction",
    )

    const host = new AnalyzerHost()

    host.seed([root], new Set(["node_modules"]))

    context = {
      ...host.snapshot(),
      components,
      index: new DefinitionIndex([]),
      unknownReferenceSeverity: undefined,
      unusedEntrySeverity: undefined,
    }
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  function at(text: string): { doc: TextDocument; offset: number } {
    const offset = text.indexOf("|")

    return { doc: TextDocument.create("file:///Card.hxs", "hxs", 1, text.replace("|", "")), offset }
  }

  function labels(text: string): string[] {
    const { doc, offset } = at(text)

    return new StylingLanguageService("style", EXT_STYLE)
      .completion(doc, doc.positionAt(offset), context)
      .map((item) => item.label)
      .sort()
  }

  it("then knows `If` and only the `@hx-*` built-ins", () => {
    expect(context.qualifiers.map((qualifier) => qualifier.name)).toEqual(["If"])
  })

  it("then completes `@hx-if` by name", () => {
    expect(labels("@hx-|")).toEqual(["if"])
  })

  it("then completes the component's properties for `value: {`", () => {
    expect(labels("@hx-if(value: {|}) { color: red; }")).toEqual(["isSaving", "variant"])
  })

  it("then completes the argument names with their documented signatures", () => {
    const { doc, offset } = at("@hx-if(|) {}")
    const items = new StylingLanguageService("style", EXT_STYLE).completion(doc, doc.positionAt(offset), context)

    expect(items.map((item) => item.label).sort()).toEqual(["is", "isNot", "value"])
  })

  it("then shows the contract on hover", () => {
    const { doc, offset } = at("@hx-i|f(value: {isSaving}) {}")
    const hover = new StylingLanguageService("style", EXT_STYLE).hover(doc, doc.positionAt(offset), context)
    const value = (hover!.contents as MarkupContent).value

    expect(value).toContain("@hx-if(value: PropertyRef, is?: unknown, isNot?: unknown)")
    expect(value).toContain("The condition subject")
  })
})
