import { Range } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"

/** Range covering the `prefixLength` characters immediately before `offset`. */
export function replaceRange(doc: TextDocument, offset: number, prefixLength: number): Range {
  return Range.create(doc.positionAt(offset - prefixLength), doc.positionAt(offset))
}
