import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
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

const repo = path.resolve(process.cwd(), "../..")

function sourceOf(dir: string): string {
  return path.join(repo, dir, "src").split(path.sep).join("/")
}

// A workspace whose TypeScript program includes hx-core's sources - as the
// monorepo does through its path mapping - so its qualifiers are read from
// their types, the way the project's own converters and actions are.
describe("built-in qualifier contracts read from hx-core's TypeScript types", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hx-builtin-qualifiers-"))
  const stylePath = path.join(root, "src", "Card.hxs")
  let context: ILanguageContext

  beforeAll(async () => {
    fs.mkdirSync(path.join(root, "src"))
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          paths: {
            "@heleonix/hx-core": [sourceOf("runtime/hx-core")],
            "@heleonix/hx-language": [sourceOf("common/hx-language")],
            "@heleonix/hx-utils": [sourceOf("common/hx-utils")],
          },
        },
        include: ["src"],
      }),
    )
    fs.writeFileSync(path.join(root, "src", "app.ts"), `export { IfQualifier } from "@heleonix/hx-core"\n`)
    fs.writeFileSync(stylePath, "color: red;\n")

    const host = new AnalyzerHost()

    host.seed([root], new Set())
    await host.diagnosticsFor(
      stylePath,
      TextDocument.create(pathToFileURL(stylePath).href, "heleonix-hx-style", 1, "color: red;\n"),
    )

    context = {
      ...(await host.snapshot(stylePath)),
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

  it("then discovers `If` with its typed arguments", () => {
    const iff = context.qualifiers.find((qualifier) => qualifier.name === "If")

    expect(iff?.args.map((arg) => `${arg.name}${arg.refKind ? `:${arg.refKind}` : ""}`)).toEqual([
      "value:property",
      "is",
      "isNot",
    ])
  })

  it("then completes only the `@hx-*` qualifiers by name, never the natively spelled Media or Pseudo", () => {
    expect(context.qualifiers.map((qualifier) => qualifier.name)).toEqual(
      jasmine.arrayContaining(["If", "Media", "Pseudo"]),
    )
    expect(labels("@hx-|")).toEqual(["if"])
  })

  it("then completes the component's properties for `value: {`", () => {
    expect(labels("@hx-if(value: {|}) { color: red; }")).toEqual(["isSaving", "variant"])
  })

  it("then completes the argument names", () => {
    expect(labels("@hx-if(|) {}")).toEqual(["is", "isNot", "value"])
  })

  it("then shows the contract and its docs on hover", () => {
    const { doc, offset } = at("@hx-i|f(value: {isSaving}) {}")
    const hover = new StylingLanguageService("style", EXT_STYLE).hover(doc, doc.positionAt(offset), context)
    const value = (hover!.contents as MarkupContent).value

    expect(value).toContain("@hx-if(value: PropertyRef, is?: unknown, isNot?: unknown)")
    expect(value).toContain("The condition subject")
  })
})
