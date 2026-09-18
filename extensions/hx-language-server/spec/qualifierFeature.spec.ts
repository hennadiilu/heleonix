import { TextDocument } from "vscode-languageserver-textdocument"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import type { IQualifierDefinition } from "@heleonix/hx-language"
import { completeQualifier, hoverQualifier } from "../src/languages/styling/qualifierFeature"
import type { MarkupContent } from "vscode-languageserver"

const qualifiers: IQualifierDefinition[] = [
  {
    name: "If",
    args: [
      { name: "value", optional: false, kind: "boolean", isFunction: false, refKind: "property" },
      { name: "is", optional: true, kind: "enum", isFunction: false, enumValues: ["primary", "danger"] },
    ],
  },
  {
    name: "Unless",
    args: [{ name: "value", optional: false, kind: "boolean", isFunction: false, refKind: "property" }],
  },
  {
    name: "OnRaising",
    args: [{ name: "event", optional: false, kind: "string", isFunction: false, refKind: "event" }],
  },
]

const components: IComponentInfo[] = [
  {
    name: "Card",
    open: false,
    members: [
      { name: "isSaving", optional: false, kind: "boolean", isFunction: false },
      { name: "variant", optional: true, kind: "enum", isFunction: false, enumValues: ["primary"] },
    ],
  },
]

const controlNames = new Map<string, readonly string[]>([["Card", ["header", "menu", "item"]]])

function at(text: string): { doc: TextDocument; offset: number } {
  const offset = text.indexOf("|")

  return { doc: TextDocument.create("file:///Card.hxs", "hxs", 1, text.replace("|", "")), offset }
}

function complete(text: string) {
  const { doc, offset } = at(text)

  return completeQualifier(doc, offset, qualifiers, components, "Card", controlNames)
}

describe("completeQualifier", () => {
  it("then completes qualifier names as kebab-case after `@hx-`", () => {
    expect(
      complete("@hx-|")!
        .map((i) => i.label)
        .sort(),
    ).toEqual(["if", "on-raising", "unless"])
  })

  it("then completes the argument names of a qualifier", () => {
    expect(
      complete("@hx-if(|")!
        .map((i) => i.label)
        .sort(),
    ).toEqual(["is", "value"])
  })

  it("then completes an enum argument's members inside its brace", () => {
    expect(complete("@hx-if(is: {|")!.map((i) => i.label)).toEqual(["'primary'", "'danger'"])
  })

  it("then routes a PropertyRef argument to the styled component's state", () => {
    expect(
      complete("@hx-if(value: {|")!
        .map((i) => i.label)
        .sort(),
    ).toEqual(["isSaving", "variant"])
  })

  it("then replaces the partial member name being typed", () => {
    const { doc, offset } = at("@hx-if(value: {isS|")
    const items = completeQualifier(doc, offset, qualifiers, components, "Card", controlNames)!
    const saving = items.find((i) => i.label === "isSaving")!

    expect(saving.textEdit).toEqual(
      jasmine.objectContaining({ range: jasmine.objectContaining({ start: doc.positionAt(offset - 3) }) }),
    )
  })

  it("then completes @hx-style(for:) scope segments from the component's control names", () => {
    expect(
      complete("@hx-style(for: |")!
        .map((i) => i.label)
        .sort(),
    ).toEqual(["header", "item", "menu"])
  })

  it("then filters scope segments by the partial after the last dot", () => {
    expect(complete("@hx-style(for: header.me|")!.map((i) => i.label)).toEqual(["menu"])
  })

  it("then returns undefined outside any `@hx-` construct", () => {
    expect(complete("color: red|")).toBeUndefined()
  })
})

function hoverValue(text: string, defs = qualifiers): string | null {
  const { doc, offset } = at(text)
  const hover = hoverQualifier(doc, offset, defs)

  return hover ? (hover.contents as MarkupContent).value : null
}

describe("hoverQualifier", () => {
  it("then shows the qualifier signature with branded ref types and enum unions", () => {
    expect(hoverValue("@hx-i|f(value: {x})")).toContain("@hx-if(value: PropertyRef, is?: 'primary' | 'danger')")
  })

  it("then renders an EventRef argument type", () => {
    expect(hoverValue("@hx-on-|raising(event: {x})")).toContain("@hx-on-raising(event: EventRef)")
  })

  it("then appends documentation for documented arguments", () => {
    const documented = [
      {
        name: "Style",
        args: [{ name: "for", optional: false, kind: "string", isFunction: false, docs: "target path" }],
      },
    ] as typeof qualifiers

    expect(hoverValue("@hx-st|yle(for: head)", documented)).toContain("`for` — target path")
  })

  it("then returns null when the cursor is not on an `@hx-` token", () => {
    expect(hoverValue("color: re|d")).toBeNull()
  })

  it("then returns null when the cursor is inside the argument list, not on the name", () => {
    expect(hoverValue("@hx-if(val|ue: {x})")).toBeNull()
  })
})
