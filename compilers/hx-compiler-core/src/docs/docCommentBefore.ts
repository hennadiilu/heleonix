import { parseDocComment, type IDocs } from "@heleonix/hx-language"

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
