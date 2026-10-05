import { parseBindingExpression, parseStyleValue } from "@heleonix/hx-language"
import type { StyleStringPart } from "@heleonix/hx-language"
import { mangleVariable } from "./mangleVariable"
import { styleVariableName } from "./styleVariableName"

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
      const reference = `var(${rawName(token.source)})`
      const next = tokens[i + 1]
      const unit = next?.kind === "raw" ? UNIT.exec(next.text)?.[0] : undefined

      css += unit ? `calc(${reference} * 1${unit})` : reference
      consumed = unit?.length ?? 0
    }
  }

  return css
}

// An unquoted theme token reads the variable the theme publishes; every other
// source reads the per-instance variable the style manager sets.
function rawName(source: string): string {
  const binding = parseBindingExpression(source)

  return binding.type === "theme" ? mangleVariable(binding.value) : styleVariableName({ source, text: false })
}

// A string with sources splits into literal pieces and text variables, which
// CSS concatenates where it accepts several strings (`content`).
function quoted(quote: string, parts: readonly StyleStringPart[]): string {
  if (!parts.some((part) => part.kind === "binding")) {
    return `${quote}${parts.map((part) => (part.kind === "raw" ? part.text : "")).join("")}${quote}`
  }

  return parts
    .map((part) =>
      part.kind === "raw"
        ? `${quote}${part.text}${quote}`
        : `var(${styleVariableName({ source: part.source, text: true })})`,
    )
    .join(" ")
}
