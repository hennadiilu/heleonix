import { parseJsonc, splitFrontmatter } from "@heleonix/hx-compiler-core"
import { REFERENCE_PREFIXES, REFERENCE_SEPARATORS, ReferenceType } from "@heleonix/hx-language"
import { Hover, Position } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../../index/DefinitionIndex"
import { markdownHover } from "../../lsp/markdownHover"
import { renderDocs } from "../../lsp/renderDocs"
import { definitionName } from "./definitionName"

/**
 * Hover for `*.hxd`/`*.hxc` entry keys: the entry's docs from the index, which
 * may come from another dimension file of the same definition or a shipped
 * docs artifact - so this shows documentation the current file doesn't carry
 * itself. Keys without docs yield no hover.
 */
export function entryKeyHover(
  doc: TextDocument,
  position: Position,
  kind: ReferenceType,
  index: DefinitionIndex,
): Hover | null {
  const text = doc.getText()

  let body: string

  try {
    body = splitFrontmatter(text).body
  } catch {
    return null
  }

  const bodyStart = text.length - body.length
  const rel = doc.offsetAt(position) - bodyStart

  let entries

  try {
    entries = parseJsonc(body).entries
  } catch {
    return null
  }

  const entry = entries.find((candidate) => rel >= candidate.keyStart && rel <= candidate.keyEnd)

  if (!entry) {
    return null
  }

  const name = definitionName(doc.uri)
  const docs = index.entryDocs(kind, name, entry.key)

  if (!docs) {
    return null
  }

  const title = `${REFERENCE_PREFIXES[kind]}${name}${REFERENCE_SEPARATORS[kind]}${entry.key}`

  return markdownHover(doc, bodyStart + entry.keyStart, bodyStart + entry.keyEnd, renderDocs(title, docs))
}
