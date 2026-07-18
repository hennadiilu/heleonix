import type { IDocs } from "@heleonix/hx-language"
import { IJsoncComment } from "../jsonc/IJsoncComment"
import { IJsoncEntry } from "../jsonc/IJsoncEntry"
import { docCommentBefore } from "./docCommentBefore"

/**
 * Docs of inline `/** ... *\/` doc comments on a JSONC document's top-level
 * entries (dictionary/config keys), keyed by entry key. `body` is the same
 * (frontmatter-stripped) text the entries and comments were parsed from, so
 * all offsets agree.
 */
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
