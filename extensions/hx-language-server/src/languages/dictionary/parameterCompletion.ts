import { splitFrontmatter, parseJsonc, IJsoncEntry } from "@heleonix/hx-compiler-core"
import {
  COMPONENT_PROPERTY_SEPARATOR,
  DICTIONARY_REF_PREFIX,
  CONFIG_REF_PREFIX,
  IDENTIFIER_PART,
  OPEN,
  CLOSE,
} from "@heleonix/hx-language"
import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { completionItem } from "../../lsp/completionItem"
import { replaceRange } from "../../lsp/replaceRange"
import { definitionName } from "../jsonc/definitionName"

const WORD_TAIL = new RegExp(`${IDENTIFIER_PART}*$`)

export function parameterCompletion(
  doc: TextDocument,
  position: Position,
  index: DefinitionIndex,
): CompletionItem[] | undefined {
  const offset = doc.offsetAt(position)
  const text = doc.getText()

  let body: string

  try {
    body = splitFrontmatter(text).body
  } catch {
    return undefined
  }

  const bodyStart = text.length - body.length
  const entry = entryAt(parseJsoncEntries(body), offset - bodyStart)

  if (!entry) {
    return undefined
  }

  const before = text.slice(0, offset)
  const open = before.lastIndexOf(OPEN)

  // Inside an open `{...}` of the value, and not a `@`/`#` reference.
  if (open < bodyStart + entry.valueStart || before.indexOf(CLOSE, open) >= 0) {
    return undefined
  }

  const typed = before.slice(open + 1)
  const lead = typed.charAt(0)

  if (lead === DICTIONARY_REF_PREFIX || lead === CONFIG_REF_PREFIX) {
    return undefined
  }

  const referrers = index.entryReferrers("dictionary", definitionName(doc.uri), entry.key)
  const tail = WORD_TAIL.exec(before)?.[0] ?? ""
  const range = replaceRange(doc, offset, tail.length)
  const colon = typed.indexOf(COMPONENT_PROPERTY_SEPARATOR)

  if (colon >= 0) {
    const control = typed.slice(0, colon).trim()
    const properties = new Set<string>()

    for (const component of referrers) {
      for (const tag of index.controlTags(component, control)) {
        for (const property of index.componentProperties(tag)) {
          properties.add(property)
        }
      }
    }

    return [...properties].sort().map((name) => completionItem(name, CompletionItemKind.Field, range))
  }

  const properties = new Set<string>()
  const controls = new Set<string>()

  for (const component of referrers) {
    for (const property of index.componentProperties(component)) {
      properties.add(property)
    }

    for (const control of index.controlNames(component)) {
      controls.add(control)
    }
  }

  return [
    ...[...properties].sort().map((name) => completionItem(name, CompletionItemKind.Field, range)),
    ...[...controls].sort().map((name) => completionItem(name, CompletionItemKind.Variable, range)),
  ]
}

function parseJsoncEntries(body: string): IJsoncEntry[] {
  try {
    return parseJsonc(body).entries
  } catch {
    return []
  }
}

function entryAt(entries: readonly IJsoncEntry[], offset: number): IJsoncEntry | undefined {
  return entries.find((entry) => offset >= entry.valueStart && offset <= entry.valueEnd)
}
