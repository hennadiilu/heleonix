// Comments are blanked to spaces (offsets kept) the way the block parser skips
// them: outside strings, and only outside parentheses. Strings stay, since an
// interpolation inside a quoted value is live.
export function blankComments(source: string): string {
  let out = ""
  let quote = ""
  let depth = 0
  let i = 0

  while (i < source.length) {
    const ch = source.charAt(i)

    if (quote) {
      out += ch
      i++

      if (ch === "\\" && i < source.length) {
        out += source.charAt(i)
        i++
      } else if (ch === quote) {
        quote = ""
      }

      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === "(") {
      depth++
    } else if (ch === ")" && depth > 0) {
      depth--
    } else if (ch === "/" && depth === 0 && (source.charAt(i + 1) === "*" || source.charAt(i + 1) === "/")) {
      const end = commentEnd(source, i)

      out += source.slice(i, end).replace(/[^\r\n]/g, " ")
      i = end

      continue
    }

    out += ch
    i++
  }

  return out
}

function commentEnd(source: string, start: number): number {
  if (source.charAt(start + 1) === "*") {
    const close = source.indexOf("*/", start + 2)

    return close < 0 ? source.length : close + 2
  }

  let end = start

  while (end < source.length && source.charAt(end) !== "\n" && source.charAt(end) !== "\r") {
    end++
  }

  return end
}
