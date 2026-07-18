import { parseDocComment, type IDocs } from "@heleonix/hx-language"

/**
 * Docs of the doc comment immediately preceding `offset`: the last collected
 * comment that ends at or before it with only whitespace in between. Works for
 * both XML and JSONC comment lists - their `value` is the text inside the
 * comment markers, which starts with `*` for doc comments; other comments in
 * that position yield `undefined` rather than being skipped over, so an
 * ordinary comment between a doc comment and a node breaks the association.
 */
export function docCommentBefore(
  comments: readonly { value: string; end: number }[],
  offset: number,
  source: string,
): IDocs | undefined {
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i]

    if (comment.end > offset) {
      continue
    }

    if (source.slice(comment.end, offset).trim()) {
      return undefined
    }

    return parseDocComment(comment.value)
  }

  return undefined
}
