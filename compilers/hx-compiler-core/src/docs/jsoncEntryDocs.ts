import type { IDocs } from "@heleonix/hx-language"
import { IJsoncComment } from "../jsonc/IJsoncComment"
import { IJsoncEntry } from "../jsonc/IJsoncEntry"
import { docCommentBefore } from "./docCommentBefore"

export function jsoncEntryDocs(
  entries: readonly IJsoncEntry[],
  comments: readonly IJsoncComment[],
  body: string,
): Record<string, IDocs> | undefined {
  let result: Record<string, IDocs> | undefined

  for (const entry of entries) {
    const docs = docCommentBefore(comments, entry.keyStart, body)

    if (docs) {
      ;(result ??= {})[entry.key] = docs
    }
  }

  return result
}
