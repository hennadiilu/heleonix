import {
  REFERENCE_PREFIXES,
  REFERENCE_SEPARATORS,
  isBindingExpression,
  parseBindingExpression,
} from "@heleonix/hx-language"
import { Hover } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { DefinitionIndex } from "../index/DefinitionIndex"
import { markdownHover } from "../lsp/markdownHover"
import { renderDocs } from "../lsp/renderDocs"

export function referenceHover(
  doc: TextDocument,
  raw: string,
  start: number,
  end: number,
  index: DefinitionIndex,
): Hover | null {
  if (!raw || !isBindingExpression(raw)) {
    return null
  }

  const expression = parseBindingExpression(raw)

  if (expression.type !== "dictionary" && expression.type !== "config") {
    return null
  }

  const split = expression.value.lastIndexOf(REFERENCE_SEPARATORS[expression.type])

  if (split <= 0) {
    return null
  }

  const name = expression.value.slice(0, split)
  const entry = expression.value.slice(split + 1)
  const docs = index.entryDocs(expression.type, name, entry)

  if (!docs) {
    return null
  }

  const title = `${REFERENCE_PREFIXES[expression.type]}${expression.value}`

  return markdownHover(doc, start, end, renderDocs(title, docs))
}
