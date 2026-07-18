import { CLOSE } from "./CLOSE"
import { OPEN } from "./OPEN"

/**
 * Grammar of curly-brace interpolation used inside dictionary templates,
 * style values, and binding expressions:
 *
 *   "Hi {username}!"             - parameter "username"
 *   "{a}px {b}px {Colors.fg}"    - parameters "a", "b", "Colors.fg"
 *
 * Helpers here are syntax-level only: they do not resolve, validate, or
 * format parameters; they expose the lexical shape of `{...}` substitution
 * so compilers and runtime can agree on it.
 *
 * Splits `input` on `separator` while ignoring occurrences that appear
 * inside `{...}` pairs. Used to safely split converter pipes and other
 * top-level delimiters across interpolated values.
 */
export function splitOnTopLevel(input: string, separator: string): string[] {
  const result: string[] = []
  const len = input.length
  let depth = 0
  let start = 0

  for (let i = 0; i < len; i++) {
    const ch = input.charAt(i)

    if (ch === OPEN) {
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
