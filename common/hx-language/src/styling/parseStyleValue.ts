import { STRING_QUOTES } from "../bindings/STRING_QUOTES"
import { CLOSE } from "../interpolation/CLOSE"
import { OPEN } from "../interpolation/OPEN"
import type { StyleStringPart } from "./StyleStringPart"
import type { StyleValueToken } from "./StyleValueToken"

// A declaration value is raw CSS text with `{...}` binding sources; a source
// inside a quoted string is inserted as text, one outside it as a raw value.
export function parseStyleValue(value: string): StyleValueToken[] {
  const tokens: StyleValueToken[] = []
  let raw = ""
  let i = 0

  const flush = (): void => {
    if (raw) {
      tokens.push({ kind: "raw", text: raw })
      raw = ""
    }
  }

  while (i < value.length) {
    const ch = value.charAt(i)
    const binding = ch === OPEN ? bindingAt(value, i) : undefined

    if (binding) {
      flush()
      tokens.push({ kind: "binding", source: binding.source })
      i = binding.end

      continue
    }

    if (STRING_QUOTES.includes(ch)) {
      flush()

      const string = stringAt(value, i)

      tokens.push({ kind: "string", quote: ch, parts: string.parts })
      i = string.end

      continue
    }

    raw += ch
    i++
  }

  flush()

  return tokens
}

function bindingAt(value: string, start: number): { source: string; end: number } | undefined {
  const close = value.indexOf(CLOSE, start + 1)
  const source = close < 0 ? "" : value.slice(start + 1, close).trim()

  return source ? { source, end: close + 1 } : undefined
}

function stringAt(value: string, start: number): { parts: StyleStringPart[]; end: number } {
  const quote = value.charAt(start)
  const parts: StyleStringPart[] = []
  let raw = ""
  let i = start + 1

  const flush = (): void => {
    if (raw) {
      parts.push({ kind: "raw", text: raw })
      raw = ""
    }
  }

  while (i < value.length) {
    const ch = value.charAt(i)

    if (ch === "\\" && i + 1 < value.length) {
      raw += value.slice(i, i + 2)
      i += 2

      continue
    }

    if (ch === quote) {
      flush()

      return { parts, end: i + 1 }
    }

    const binding = ch === OPEN ? bindingAt(value, i) : undefined

    if (binding) {
      flush()
      parts.push({ kind: "binding", source: binding.source })
      i = binding.end

      continue
    }

    raw += ch
    i++
  }

  flush()

  return { parts, end: i }
}
