import { styleVariableName } from "@heleonix/hx-core"
import { parseStyleValue } from "@heleonix/hx-language"
import type { StyleStringPart } from "@heleonix/hx-language"

const UNIT = /^[a-z%]+/i

export function interpolateValue(value: string): string {
  const tokens = parseStyleValue(value)
  let css = ""
  let consumed = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.kind === "raw") {
      css += token.text.slice(consumed)
      consumed = 0
    } else if (token.kind === "string") {
      css += quoted(token.quote, token.parts)
    } else {
      const reference = `var(--${styleVariableName(token.source, false)})`
      const next = tokens[i + 1]
      const unit = next?.kind === "raw" ? UNIT.exec(next.text)?.[0] : undefined

      css += unit ? `calc(${reference} * 1${unit})` : reference
      consumed = unit?.length ?? 0
    }
  }

  return css
}

// A string with sources splits into literal pieces and text variables, which
// CSS concatenates where it accepts several strings (`content`).
function quoted(quote: string, parts: readonly StyleStringPart[]): string {
  if (!parts.some((part) => part.kind === "binding")) {
    return `${quote}${parts.map((part) => (part.kind === "raw" ? part.text : "")).join("")}${quote}`
  }

  return parts
    .map((part) =>
      part.kind === "raw" ? `${quote}${part.text}${quote}` : `var(--${styleVariableName(part.source, true)})`,
    )
    .join(" ")
}
