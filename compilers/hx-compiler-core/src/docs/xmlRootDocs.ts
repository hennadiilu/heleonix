import type { IDocs } from "@heleonix/hx-language"
import { IXmlScan } from "../xml/IXmlScan"
import { docCommentBefore } from "./docCommentBefore"

/**
 * Docs of the doc comment placed directly above the document's `<rootTag>`
 * element - the file-level documentation of `*.hxm` (above `<Component>`),
 * `*.hxs` (above `<Style>`) and `*.hxt` (above `<Theme>`) sources.
 */
export function xmlRootDocs(scan: IXmlScan, source: string, rootTag: string): IDocs | undefined {
  const root = scan.tags.find((tag) => !tag.closing && tag.name === rootTag)

  return root ? docCommentBefore(scan.comments, root.nameStart - 1, source) : undefined
}
