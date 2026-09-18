import { CompletionItem, CompletionItemKind } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import {
  IDENTIFIER_PATTERN,
  REFERENCE_PREFIXES,
  REFERENCE_SEPARATORS,
  REFERENCE_TYPES,
  ReferenceType,
} from "@heleonix/hx-language"
import { DefinitionIndex } from "../index/DefinitionIndex"
import { completionItem } from "../lsp/completionItem"
import { replaceRange } from "../lsp/replaceRange"
import { REFERENCE_ITEM_KINDS } from "./referenceItemKinds"

// A possibly-partial qualified name under the cursor: `Name`, `Name.`, or
// `Name.entry`. The trailing `\.?` tolerates the in-progress dot that switches
// completion from names to entries.
const REF_NAME = `${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})*\\.?`
const REF_PATTERNS: ReadonlyMap<ReferenceType, RegExp> = new Map(
  REFERENCE_TYPES.map((kind) => [kind, new RegExp(`${REFERENCE_PREFIXES[kind]}(${REF_NAME})?$`)]),
)

export function referenceCompletion(
  doc: TextDocument,
  offset: number,
  line: string,
  index: DefinitionIndex,
): CompletionItem[] | undefined {
  for (const kind of REFERENCE_TYPES) {
    const match = REF_PATTERNS.get(kind)?.exec(line)

    if (match) {
      return refItems(
        doc,
        offset,
        match[1] ?? "",
        REFERENCE_SEPARATORS[kind],
        REFERENCE_ITEM_KINDS[kind],
        index.names(kind),
        (name) => index.entries(kind, name),
        (name, entry) => index.entryDocs(kind, name, entry)?.summary,
      )
    }
  }

  return undefined
}

function refItems(
  doc: TextDocument,
  offset: number,
  typed: string,
  separator: string,
  itemKind: CompletionItemKind,
  names: readonly string[],
  entriesOf: (name: string) => readonly string[],
  docsOf: (name: string, entry: string) => string | undefined,
): CompletionItem[] {
  const split = typed.lastIndexOf(separator)

  if (split >= 0) {
    const name = typed.slice(0, split)
    const range = replaceRange(doc, offset, typed.length - split - 1)
    return entriesOf(name).map((entry) => completionItem(entry, itemKind, range, docsOf(name, entry)))
  }

  const range = replaceRange(doc, offset, typed.length)
  return names.map((name) => completionItem(name, itemKind, range))
}
