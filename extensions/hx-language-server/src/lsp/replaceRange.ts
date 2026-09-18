import { Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

export function replaceRange(doc: TextDocument, offset: number, prefixLength: number): Range {
  return Range.create(doc.positionAt(offset - prefixLength), doc.positionAt(offset))
}
