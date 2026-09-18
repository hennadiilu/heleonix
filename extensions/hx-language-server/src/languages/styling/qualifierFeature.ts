import { CompletionItem, CompletionItemKind, Hover, MarkupKind, Range, TextEdit } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import type { IComponentInfo } from "@heleonix/hx-analyzer"
import type { IQualifierArg, IQualifierDefinition, QualifierRefKind } from "@heleonix/hx-language"

const NAME = /@hx-([A-Za-z-]*)$/
const CALL = /@hx-([A-Za-z][A-Za-z-]*)\(([^)]*)$/
const BARE = /^[A-Za-z_]/
const TOKEN_CHAR = /[@A-Za-z-]/
const REF_TYPE: Record<QualifierRefKind, string> = {
  property: "PropertyRef",
  event: "EventRef",
  theme: "ThemeTokenRef",
}

type Context =
  | { kind: "name"; partial: string }
  | { kind: "arg-name"; qualifier: string; partial: string }
  | { kind: "arg-value"; qualifier: string; arg: string; inBrace: boolean; inner: string }

export function completeQualifier(
  doc: TextDocument,
  offset: number,
  qualifiers: readonly IQualifierDefinition[],
  components: readonly IComponentInfo[],
  componentName: string,
  controlNames: ReadonlyMap<string, readonly string[]>,
): CompletionItem[] | undefined {
  const context = contextAt(doc.getText(), offset)

  if (!context) {
    return undefined
  }

  if (context.kind === "name") {
    return qualifiers.map((q) => nameItem(pascalToKebab(q.name), replacing(doc, offset, context.partial)))
  }

  // `@hx-style(for: ...)` scope paths route to the component's control tree even
  // when no `Style` qualifier class is registered (the construct is compiled and
  // validated by the analyzer regardless).
  if (context.kind === "arg-value" && context.qualifier === "Style" && context.arg === "for") {
    return completeScopePath(doc, offset, context.inner, controlNames.get(componentName) ?? [])
  }

  const qualifier = qualifiers.find((q) => q.name === context.qualifier)

  if (!qualifier) {
    return []
  }

  if (context.kind === "arg-name") {
    return qualifier.args.map((arg) =>
      item(arg.name, CompletionItemKind.Property, replacing(doc, offset, context.partial), signature(arg)),
    )
  }

  return argValues(doc, offset, context, qualifier, components, componentName)
}

function argValues(
  doc: TextDocument,
  offset: number,
  context: { arg: string; inBrace: boolean; inner: string },
  qualifier: IQualifierDefinition,
  components: readonly IComponentInfo[],
  componentName: string,
): CompletionItem[] {
  const arg = qualifier.args.find((a) => a.name === context.arg)

  if (!arg || !context.inBrace) {
    return []
  }

  if (arg.kind === "enum" && arg.enumValues && (context.inner === "" || context.inner.startsWith("'"))) {
    const range = replacing(doc, offset, context.inner)

    return arg.enumValues.map((value) => item(`'${value}'`, CompletionItemKind.EnumMember, range))
  }

  if ((arg.refKind === "property" || arg.refKind === "event") && (context.inner === "" || BARE.test(context.inner))) {
    const members = components.find((c) => c.name === componentName)?.members ?? []
    const range = replacing(doc, offset, context.inner)

    return members.map((member) => item(member.name, CompletionItemKind.Field, range, member.docs))
  }

  return []
}

function completeScopePath(
  doc: TextDocument,
  offset: number,
  inner: string,
  controls: readonly string[],
): CompletionItem[] {
  const lastDot = inner.lastIndexOf(".")
  const partial = lastDot >= 0 ? inner.slice(lastDot + 1) : inner
  const range = replacing(doc, offset, partial)

  return controls.filter((name) => name.startsWith(partial)).map((name) => item(name, CompletionItemKind.Field, range))
}

export function hoverQualifier(
  doc: TextDocument,
  offset: number,
  qualifiers: readonly IQualifierDefinition[],
): Hover | null {
  const name = qualifierNameAt(doc.getText(), offset)

  if (name === undefined) {
    return null
  }

  const qualifier = qualifiers.find((q) => q.name === name)

  if (!qualifier) {
    return null
  }

  const params = qualifier.args.map(argSignature).join(", ")
  const lines = ["```ts", `@hx-${pascalToKebab(qualifier.name)}(${params})`, "```"]

  for (const arg of qualifier.args) {
    if (arg.docs) {
      lines.push(`- \`${arg.name}\` — ${arg.docs}`)
    }
  }

  return { contents: { kind: MarkupKind.Markdown, value: lines.join("\n") } }
}

function qualifierNameAt(text: string, offset: number): string | undefined {
  let start = offset

  while (start > 0 && TOKEN_CHAR.test(text.charAt(start - 1))) {
    start -= 1
  }

  let end = offset

  while (end < text.length && TOKEN_CHAR.test(text.charAt(end))) {
    end += 1
  }

  const match = /^@hx-([A-Za-z][A-Za-z-]*)$/.exec(text.slice(start, end))

  return match ? kebabToPascal(match[1]) : undefined
}

function argSignature(arg: IQualifierArg): string {
  return `${arg.name}${arg.optional ? "?" : ""}: ${argType(arg)}`
}

function argType(arg: IQualifierArg): string {
  if (arg.refKind) {
    return REF_TYPE[arg.refKind]
  }

  if (arg.kind === "enum") {
    return (arg.enumValues ?? []).map((value) => `'${value}'`).join(" | ")
  }

  return arg.kind
}

function contextAt(text: string, offset: number): Context | undefined {
  const boundary = Math.max(
    text.lastIndexOf("\n", offset - 1),
    text.lastIndexOf("\r", offset - 1),
    text.lastIndexOf(";", offset - 1),
  )
  const window = text.slice(boundary + 1, offset)

  const name = NAME.exec(window)

  if (name) {
    return { kind: "name", partial: name[1] }
  }

  const call = CALL.exec(window)

  if (!call) {
    return undefined
  }

  const qualifier = kebabToPascal(call[1])
  const lastArg = lastSegment(call[2])
  const colon = topLevelIndexOf(lastArg, ":")

  if (colon < 0) {
    return { kind: "arg-name", qualifier, partial: lastArg.trim() }
  }

  const rawValue = lastArg.slice(colon + 1)
  const brace = rawValue.lastIndexOf("{")

  return {
    kind: "arg-value",
    qualifier,
    arg: lastArg.slice(0, colon).trim(),
    inBrace: brace >= 0,
    inner: brace >= 0 ? rawValue.slice(brace + 1) : rawValue.trim(),
  }
}

function nameItem(label: string, range: Range): CompletionItem {
  return item(label, CompletionItemKind.Keyword, range)
}

function item(label: string, kind: CompletionItemKind, range: Range, documentation?: string): CompletionItem {
  const result: CompletionItem = { label, kind, filterText: label, textEdit: TextEdit.replace(range, label) }

  if (documentation) {
    result.documentation = documentation
  }

  return result
}

function signature(arg: IQualifierArg): string {
  const type = arg.kind === "enum" ? (arg.enumValues ?? []).map((value) => `'${value}'`).join(" | ") : arg.kind

  return `${arg.name}${arg.optional ? "?" : ""}: ${type}`
}

function replacing(doc: TextDocument, offset: number, partial: string): Range {
  return Range.create(doc.positionAt(offset - partial.length), doc.positionAt(offset))
}

function lastSegment(args: string): string {
  let depth = 0
  let quote = ""
  let start = 0

  for (let i = 0; i < args.length; i++) {
    const ch = args.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "{" || ch === "[") {
      depth++
    } else if (ch === ")" || ch === "}" || ch === "]") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === "," && depth === 0) {
      start = i + 1
    }
  }

  return args.slice(start)
}

function topLevelIndexOf(text: string, target: string): number {
  let depth = 0
  let quote = ""

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "{" || ch === "[") {
      depth++
    } else if (ch === ")" || ch === "}" || ch === "]") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === target && depth === 0) {
      return i
    }
  }

  return -1
}

function pascalToKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

function kebabToPascal(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}
