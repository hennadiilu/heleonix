import { CLOSE } from "./CLOSE"
import { ISoleExpression } from "./ISoleExpression"
import { OPEN } from "./OPEN"

const QUOTES = "'\""

export function soleExpression(value: string): ISoleExpression | undefined {
  const leading = value.length - value.trimStart().length
  const trimmed = value.trim()

  if (trimmed.charAt(0) !== OPEN) {
    return undefined
  }

  const len = trimmed.length
  let depth = 0
  let quote = ""

  for (let i = 0; i < len; i++) {
    const ch = trimmed.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }

      continue
    }

    if (QUOTES.indexOf(ch) >= 0) {
      quote = ch
    } else if (ch === OPEN) {
      depth++
    } else if (ch === CLOSE) {
      depth--

      if (depth === 0) {
        return i === len - 1 ? { text: trimmed.slice(1, -1), start: leading + 1, end: leading + len - 1 } : undefined
      }
    }
  }

  return undefined
}
