import { CLOSE } from "./CLOSE"
import { OPEN } from "./OPEN"

const QUOTES = "'\""

export function splitOnTopLevel(input: string, separator: string): string[] {
  const result: string[] = []
  const len = input.length
  let depth = 0
  let quote = ""
  let start = 0

  for (let i = 0; i < len; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (QUOTES.indexOf(ch) >= 0) {
      quote = ch
    } else if (ch === OPEN) {
      depth++
    } else if (ch === CLOSE) {
      if (depth > 0) {
        depth--
      }
    } else if (ch === separator && depth === 0) {
      result.push(input.slice(start, i))
      start = i + 1
    }
  }

  result.push(input.slice(start))

  return result
}
