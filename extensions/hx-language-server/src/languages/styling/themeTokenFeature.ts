import { pathToFileURL } from "node:url"
import { CompletionItem, CompletionItemKind, Hover, Location, MarkupKind, Range, TextEdit } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import type { IThemeTokenLocation } from "@heleonix/hx-analyzer"

const PATH_CHAR = /[A-Za-z0-9_.]/

export function completeThemeToken(
  doc: TextDocument,
  offset: number,
  themeTokens: ReadonlyMap<string, string>,
): CompletionItem[] | undefined {
  const typed = themePrefixAt(doc.getText(), offset)

  if (typed === undefined) {
    return undefined
  }

  const lastDot = typed.lastIndexOf(".")
  const committed = lastDot >= 0 ? typed.slice(0, lastDot + 1) : ""
  const partial = lastDot >= 0 ? typed.slice(lastDot + 1) : typed
  const segments = new Map<string, string | undefined>()

  for (const [path, value] of themeTokens) {
    if (!path.startsWith(committed)) {
      continue
    }

    const rest = path.slice(committed.length)

    if (rest === "") {
      continue
    }

    const dot = rest.indexOf(".")
    const segment = dot >= 0 ? rest.slice(0, dot) : rest

    if (!segments.has(segment)) {
      segments.set(segment, dot >= 0 ? undefined : value)
    }
  }

  const range = Range.create(doc.positionAt(offset - partial.length), doc.positionAt(offset))

  return [...segments].map(([segment, value]) => item(segment, value, range))
}

export function hoverThemeToken(
  doc: TextDocument,
  offset: number,
  themeTokens: ReadonlyMap<string, string>,
): Hover | null {
  const text = doc.getText()
  const path = themePathAt(text, offset)

  if (path === undefined || !themeTokens.has(path)) {
    return null
  }

  const value = themeTokens.get(path) as string
  const lines = ["```css", `{$${path}}: ${value};`, "```"]
  const chain = aliasChain(path, themeTokens)

  if (chain.length > 1) {
    const terminal = themeTokens.get(chain[chain.length - 1])
    lines.push(`Resolves to \`${terminal}\` via ${chain.join(" → ")}`)
  }

  return { contents: { kind: MarkupKind.Markdown, value: lines.join("\n") } }
}

export function definitionThemeToken(
  doc: TextDocument,
  offset: number,
  locations: ReadonlyMap<string, IThemeTokenLocation>,
): Location | null {
  const path = themePathAt(doc.getText(), offset)
  const location = path === undefined ? undefined : locations.get(path)

  if (!location) {
    return null
  }

  return {
    uri: pathToFileURL(location.file).toString(),
    range: {
      start: { line: location.line, character: location.character },
      end: { line: location.line, character: location.character + location.length },
    },
  }
}

function item(label: string, value: string | undefined, range: Range): CompletionItem {
  const result: CompletionItem = {
    label,
    kind: value === undefined ? CompletionItemKind.Module : CompletionItemKind.Field,
    filterText: label,
    textEdit: TextEdit.replace(range, label),
  }

  if (value !== undefined) {
    result.detail = value
  }

  return result
}

function themePrefixAt(text: string, offset: number): string | undefined {
  let start = offset

  while (start > 0 && PATH_CHAR.test(text.charAt(start - 1))) {
    start -= 1
  }

  return text.charAt(start - 1) === "$" && text.charAt(start - 2) === "{" ? text.slice(start, offset) : undefined
}

function themePathAt(text: string, offset: number): string | undefined {
  let start = offset

  while (start > 0 && PATH_CHAR.test(text.charAt(start - 1))) {
    start -= 1
  }

  if (!(text.charAt(start - 1) === "$" && text.charAt(start - 2) === "{")) {
    return undefined
  }

  let end = offset

  while (end < text.length && PATH_CHAR.test(text.charAt(end))) {
    end += 1
  }

  return text.slice(start, end)
}

function aliasChain(path: string, themeTokens: ReadonlyMap<string, string>): string[] {
  const chain = [path]
  const seen = new Set([path])
  let current = path

  for (;;) {
    const alias = pureAlias(themeTokens.get(current))

    if (!alias || seen.has(alias)) {
      break
    }

    chain.push(alias)
    seen.add(alias)
    current = alias
  }

  return chain
}

function pureAlias(value: string | undefined): string | undefined {
  const match = value ? /^\{\$([A-Za-z0-9_.]+)\}$/.exec(value.trim()) : null

  return match ? match[1] : undefined
}
