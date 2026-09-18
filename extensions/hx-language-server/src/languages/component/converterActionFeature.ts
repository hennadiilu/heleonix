import { pathToFileURL } from "node:url"
import { ACTION_ATTRIBUTE, CONVERTER_PIPE, soleExpression } from "@heleonix/hx-language"
import type { IMemberType, IConverterActionInfo } from "@heleonix/hx-analyzer"
import type { IXmlScan } from "@heleonix/hx-compiler-core"
import { CompletionItem, CompletionItemKind, Hover, Location, MarkupKind, Range, TextEdit } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

const EXECUTE_TAG = "Execute"
const IDENT = /[A-Za-z0-9_$]/

type Context = { kind: "converter" } | { kind: "action" } | { kind: "converter-arg"; converter: string }

export function completeConverterAction(
  doc: TextDocument,
  offset: number,
  scan: IXmlScan,
  converters: readonly IConverterActionInfo[],
  actions: readonly IConverterActionInfo[],
): CompletionItem[] | undefined {
  const found = contextAt(doc.getText(), offset, scan)

  if (!found) {
    return undefined
  }

  const context = found.context
  const text = doc.getText()
  const range = { start: doc.positionAt(wordStart(text, offset)), end: doc.positionAt(offset) }

  if (context.kind === "action") {
    return actions.map((info) => nameItem(info, range))
  }

  if (context.kind === "converter") {
    return converters.map((info) => nameItem(info, range))
  }

  const converter = converters.find((info) => info.name === context.converter)

  return converter?.params.map((param) => item(param.name, CompletionItemKind.Field, range, param.docs)) ?? []
}

export function hoverConverterAction(
  doc: TextDocument,
  offset: number,
  scan: IXmlScan,
  converters: readonly IConverterActionInfo[],
  actions: readonly IConverterActionInfo[],
): Hover | null {
  const info = registryAt(doc, offset, scan, converters, actions)

  if (!info) {
    return null
  }

  const kind = info.pool === "converter" ? "converter" : "action"
  const lines = [`\`\`\`ts\n${signature(info.entry)}\n\`\`\``, `*${kind}*`]

  if (info.entry.docs) {
    lines.push(info.entry.docs)
  }

  return { contents: { kind: MarkupKind.Markdown, value: lines.join("\n\n") } }
}

export function definitionConverterAction(
  doc: TextDocument,
  offset: number,
  scan: IXmlScan,
  converters: readonly IConverterActionInfo[],
  actions: readonly IConverterActionInfo[],
): Location | null {
  const info = registryAt(doc, offset, scan, converters, actions)

  if (!info?.entry.file || info.entry.line === undefined || info.entry.character === undefined) {
    return null
  }

  const position = { line: info.entry.line, character: info.entry.character }

  return { uri: pathToFileURL(info.entry.file).toString(), range: { start: position, end: position } }
}

function registryAt(
  doc: TextDocument,
  offset: number,
  scan: IXmlScan,
  converters: readonly IConverterActionInfo[],
  actions: readonly IConverterActionInfo[],
): { entry: IConverterActionInfo; pool: "converter" | "action" } | undefined {
  const found = contextAt(doc.getText(), offset, scan)

  if (!found || found.context.kind === "converter-arg") {
    return undefined
  }

  const word = wordAround(doc.getText(), offset)
  const pool = found.context.kind === "action" ? actions : converters
  const entry = pool.find((info) => info.name === word)

  return entry ? { entry, pool: found.context.kind } : undefined
}

function nameItem(info: IConverterActionInfo, range: Range): CompletionItem {
  return item(info.name, CompletionItemKind.Function, range, info.docs ?? signature(info))
}

function item(label: string, kind: CompletionItemKind, range: Range, documentation?: string): CompletionItem {
  const result: CompletionItem = { label, kind, filterText: label, textEdit: TextEdit.replace(range, label) }

  if (documentation) {
    result.documentation = { kind: MarkupKind.Markdown, value: documentation }
  }

  return result
}

function signature(info: IConverterActionInfo): string {
  const params = info.params.map((param) => `${param.name}${param.optional ? "?" : ""}: ${paramKind(param)}`)

  return `${info.name}(${params.join(", ")})`
}

function paramKind(param: IMemberType): string {
  return param.kind === "enum" ? (param.enumValues ?? []).map((value) => `'${value}'`).join(" | ") : param.kind
}

function contextAt(text: string, offset: number, scan: IXmlScan): { context: Context } | undefined {
  const region = regionAt(text, offset, scan)

  if (!region) {
    return undefined
  }

  if (region.isActionValue) {
    return { context: { kind: "action" } }
  }

  const rel = offset - region.start
  const segment = segmentAt(region.text, rel)

  // Segment 0 is the binding source, not a converter.
  if (segment.index === 0) {
    return undefined
  }

  const parenAt = segment.text.indexOf("(")
  const converter = /[A-Za-z_$][\w$]*/.exec(segment.text)?.[0] ?? ""

  if (parenAt >= 0 && rel > segment.start + parenAt) {
    return { context: { kind: "converter-arg", converter } }
  }

  return { context: { kind: "converter" } }
}

function regionAt(
  text: string,
  offset: number,
  scan: IXmlScan,
): { text: string; start: number; isActionValue: boolean } | undefined {
  for (const tag of scan.tags) {
    if (tag.closing) {
      continue
    }

    for (const attr of tag.attrs) {
      if (attr.valueStart === undefined) {
        continue
      }

      const isActionValue = tag.name === EXECUTE_TAG && attr.name === ACTION_ATTRIBUTE

      // Converter chains live in braced expressions; the one static value with
      // completions of its own is the quoted action name.
      if (attr.kind !== "expression" && !(isActionValue && attr.kind === "literal")) {
        continue
      }

      const end = attr.valueEnd ?? Number.MAX_SAFE_INTEGER

      if (offset >= attr.valueStart && offset <= end) {
        return {
          text: text.slice(attr.valueStart, Math.min(end, text.length)),
          start: attr.valueStart,
          isActionValue,
        }
      }
    }
  }

  for (const run of scan.texts) {
    if (offset >= run.start && offset <= run.end) {
      const expression = soleExpression(run.value)

      if (!expression) {
        return undefined
      }

      const start = run.start + expression.start

      return { text: text.slice(start, run.start + expression.end), start, isActionValue: false }
    }
  }

  return undefined
}

function segmentAt(text: string, rel: number): { index: number; start: number; text: string } {
  const bounds = [0]
  let depth = 0
  let quote = ""

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch
    } else if (ch === "(") {
      depth += 1
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1)
    } else if (ch === CONVERTER_PIPE && depth === 0) {
      bounds.push(i + 1)
    }
  }

  for (let index = bounds.length - 1; index >= 0; index--) {
    if (rel >= bounds[index]) {
      const start = bounds[index]
      const end = index + 1 < bounds.length ? bounds[index + 1] - 1 : text.length

      return { index, start, text: text.slice(start, end) }
    }
  }

  return { index: 0, start: 0, text }
}

function wordStart(text: string, offset: number): number {
  let i = offset

  while (i > 0 && IDENT.test(text.charAt(i - 1))) {
    i -= 1
  }

  return i
}

function wordAround(text: string, offset: number): string {
  let end = offset

  while (end < text.length && IDENT.test(text.charAt(end))) {
    end += 1
  }

  return text.slice(wordStart(text, offset), end)
}
