import { Hover, MarkupKind } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export function markdownHover(doc: TextDocument, start: number, end: number, markdown: string): Hover {
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range: { start: doc.positionAt(start), end: doc.positionAt(end) },
  }
}
