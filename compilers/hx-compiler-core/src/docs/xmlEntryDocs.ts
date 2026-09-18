import { PROPERTY_NAME_SEGMENT_SEPARATOR, type IDocs } from "@heleonix/hx-language"
import { IXmlScan } from "../xml/IXmlScan"
import { docCommentBefore } from "./docCommentBefore"

export function xmlEntryDocs(scan: IXmlScan, source: string): Record<string, IDocs> | undefined {
  const stack: string[] = []
  let entries: Record<string, IDocs> | undefined

  for (const tag of scan.tags) {
    if (tag.closing) {
      stack.pop()
      continue
    }

    if (stack.length > 0) {
      const docs = docCommentBefore(scan.comments, tag.nameStart - 1, source)

      if (docs) {
        const path = [...stack.slice(1), tag.name].join(PROPERTY_NAME_SEGMENT_SEPARATOR)
        ;(entries ??= {})[path] = docs
      }
    }

    if (!tag.selfClosing) {
      stack.push(tag.name)
    }
  }

  return entries
}
