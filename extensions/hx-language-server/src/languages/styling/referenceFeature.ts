import { REFERENCE_PREFIXES, REFERENCE_TYPES } from "@heleonix/hx-language"
import { CompletionItem, Hover } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { referenceCompletion } from "../../references/referenceCompletion"
import { referenceHover } from "../../references/referenceHover"
import { scanStyleReferences } from "../../references/scanStyleReferences"
import { openBraceBefore } from "./openBraceBefore"

const REFERENCE_START = new RegExp(`^[${REFERENCE_TYPES.map((kind) => REFERENCE_PREFIXES[kind]).join("")}]`)

// Only `{` directly before `@`/`#` makes a reference: bare, they begin an at-rule
// (`@media`, `@hx-if`) or a hex color (`#fff`), and a block's `{ ` is followed by space.
export function completeReference(
  doc: TextDocument,
  offset: number,
  index: DefinitionIndex,
): CompletionItem[] | undefined {
  const text = doc.getText()
  const open = openBraceBefore(text, offset)

  if (open < 0) {
    return undefined
  }

  const inner = text.slice(open + 1, offset)

  return REFERENCE_START.test(inner) ? referenceCompletion(doc, offset, inner, index) : undefined
}

export function hoverReference(doc: TextDocument, offset: number, index: DefinitionIndex): Hover | null {
  const text = doc.getText()
  const ref = scanStyleReferences(text).find((candidate) => offset >= candidate.start && offset <= candidate.end)

  return ref ? referenceHover(doc, text.slice(ref.start, ref.end), ref.start, ref.end, index) : null
}
