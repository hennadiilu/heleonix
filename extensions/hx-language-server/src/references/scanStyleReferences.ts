import { IDENTIFIER_PATTERN, REFERENCE_PREFIXES, REFERENCE_SEPARATORS, REFERENCE_TYPES } from "@heleonix/hx-language"
import type { ReferenceType } from "@heleonix/hx-language"
import type { IInterpolationRef } from "./IInterpolationRef"

const KIND_BY_PREFIX: ReadonlyMap<string, ReferenceType> = new Map(
  REFERENCE_TYPES.map((kind) => [REFERENCE_PREFIXES[kind], kind]),
)

// Anchored on the identifier grammar, so a block body (`{ @hx-apply(token: A.B); }`)
// or a hex color (`#fff`) never reads as a reference; a converter pipe may follow.
const REFERENCE = new RegExp(
  `\\{\\s*([${[...KIND_BY_PREFIX.keys()].join("")}])(${IDENTIFIER_PATTERN}(?:\\.${IDENTIFIER_PATTERN})+)\\s*(?:\\|[^{}]*)?\\}`,
  "g",
)

export function scanStyleReferences(source: string): IInterpolationRef[] {
  const refs: IInterpolationRef[] = []
  const text = blankComments(source)
  const pattern = new RegExp(REFERENCE.source, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const kind = KIND_BY_PREFIX.get(match[1])!
    const path = match[2]
    const split = path.lastIndexOf(REFERENCE_SEPARATORS[kind])
    const start = match.index + match[0].indexOf(match[1])

    refs.push({ kind, name: path.slice(0, split), entry: path.slice(split + 1), start, end: start + 1 + path.length })
  }

  return refs
}

// Comments are blanked to spaces (offsets kept) the way the style parser skips
// them: outside strings, and only outside parentheses. Strings stay, since an
// interpolation inside a quoted value is live.
function blankComments(source: string): string {
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
