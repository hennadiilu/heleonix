import type { IQualifierUsage } from "./IQualifierUsage"
import { RULE_KEY_SEPARATOR } from "./RULE_KEY_SEPARATOR"

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const ARG_BOUNDARY = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:/

/**
 * Parses a compiled style rule key into its qualifier segments. The empty key
 * (the root rule `""`) yields an empty list. Reading is paren/bracket/brace and
 * quote aware, so opaque values (`Media(query:(400px <= width <= 700px),print)`,
 * `16/9`, `{$Colors.x}`) are preserved verbatim. Inverse of {@link stringifyRuleKey}.
 */
export function parseRuleKey(key: string): IQualifierUsage[] {
  const trimmed = key.trim()

  return trimmed === "" ? [] : splitTopLevel(trimmed, RULE_KEY_SEPARATOR).map(parseSegment)
}

function parseSegment(segment: string): IQualifierUsage {
  const text = segment.trim()
  const open = text.indexOf("(")

  if (open < 0) {
    return { name: text, args: {} }
  }

  const name = text.slice(0, open).trim()
  const inner = text.slice(open + 1, text.lastIndexOf(")"))
  const args: Record<string, string> = {}
  let positional: string | undefined

  for (const raw of splitArguments(inner)) {
    const arg = raw.trim()

    if (arg === "") {
      continue
    }

    const colon = topLevelIndexOf(arg, ":")
    const argName = colon > 0 ? arg.slice(0, colon).trim() : ""

    if (colon > 0 && IDENTIFIER.test(argName)) {
      args[argName] = arg.slice(colon + 1).trim()
    } else {
      positional = arg
    }
  }

  return positional !== undefined ? { name, args, positional } : { name, args }
}

/**
 * Splits an argument list on a top-level `,` only when the next argument opens a
 * named argument (`identifier:`). A comma followed by anything else is value
 * text - a media-query list (`...),print`) or a functional-pseudo selector list
 * (`.a,.b`) stays in one value.
 */
function splitArguments(input: string): string[] {
  const result: string[] = []
  let depth = 0
  let quote = ""
  let start = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === "," && depth === 0 && ARG_BOUNDARY.test(input.slice(i + 1))) {
      result.push(input.slice(start, i))
      start = i + 1
    }
  }

  result.push(input.slice(start))

  return result
}

function splitTopLevel(input: string, separator: string): string[] {
  const result: string[] = []
  let depth = 0
  let quote = ""
  let start = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
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

function topLevelIndexOf(input: string, target: string): number {
  let depth = 0
  let quote = ""

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i)

    if (quote) {
      if (ch === quote) {
        quote = ""
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth > 0) {
        depth--
      }
    } else if (ch === target && depth === 0) {
      return i
    }
  }

  return -1
}
