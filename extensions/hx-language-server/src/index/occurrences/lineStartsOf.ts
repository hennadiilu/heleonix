/**
 * Offsets at which each line begins, so an absolute offset can later be mapped
 * to an LSP position (line + character) without keeping the file's text. Counts
 * `\n`, `\r` and `\r\n` as line breaks, matching how `TextDocument` splits lines,
 * so ranges line up with the editor's own view of open documents.
 */
export function lineStartsOf(text: string): number[] {
  const starts = [0]
  const length = text.length
  let i = 0

  while (i < length) {
    const code = text.charCodeAt(i)

    if (code === 13 /* \r */) {
      if (i + 1 < length && text.charCodeAt(i + 1) === 10 /* \n */) {
        i++
      }

      starts.push(i + 1)
    } else if (code === 10 /* \n */) {
      starts.push(i + 1)
    }

    i++
  }

  return starts
}
