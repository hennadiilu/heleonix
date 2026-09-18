import { splitFrontmatter, parseJsonc, IJsoncEntry } from "@heleonix/hx-compiler-core"
import { OPEN, ReferenceType } from "@heleonix/hx-language"
import { CompletionItem, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { completionItem } from "../../lsp/completionItem"
import { replaceRange } from "../../lsp/replaceRange"
import { REFERENCE_ITEM_KINDS } from "../../references/referenceItemKinds"
import { definitionName } from "./definitionName"

// A key being typed at the start of an object member: after `{`, a `,`, or line
// start, optionally inside an opening quote.
const KEY_POSITION = /(?:^|[{,])\s*"?([A-Za-z_][\w-]*)?$/

export function entryKeyCompletion(
  doc: TextDocument,
  position: Position,
  kind: ReferenceType,
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
  const rel = offset - bodyStart
  const open = body.indexOf(OPEN)

  if (rel <= open) {
    return undefined
  }

  const entries = parseEntries(body)

  // Not inside an existing entry's value.
  if (entries.some((entry) => rel > entry.valueStart && rel < entry.valueEnd)) {
    return undefined
  }

  const before = text.slice(0, offset)
  const match = KEY_POSITION.exec(before.slice(before.lastIndexOf("\n") + 1))

  if (!match) {
    return undefined
  }

  const typed = match[1] ?? ""
  const defined = new Set(entries.map((entry) => entry.key))
  const range = replaceRange(doc, offset, typed.length)

  return index
    .referencedEntries(kind, definitionName(doc.uri))
    .filter((key) => !defined.has(key))
    .map((key) => completionItem(key, REFERENCE_ITEM_KINDS[kind], range))
}

function parseEntries(body: string): IJsoncEntry[] {
  try {
    return parseJsonc(body).entries
  } catch {
    return []
  }
}
