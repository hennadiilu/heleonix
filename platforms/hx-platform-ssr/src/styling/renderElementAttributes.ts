import type { SsrElementState } from "./SsrElementState"

// Values reach the markup from state, dictionaries and configs (and text
// variables always carry quotes), so every attribute value is escaped.
export function renderElementAttributes(state: SsrElementState): string {
  const parts: string[] = []

  if (state.classes.size > 0) {
    parts.push(`class="${escapeAttribute([...state.classes].join(" "))}"`)
  }

  if (state.styles.size > 0) {
    const declarations = [...state.styles].map(([property, value]) => `${property}: ${value}`).join("; ")

    parts.push(`style="${escapeAttribute(declarations)}"`)
  }

  for (const [name, value] of state.attributes) {
    parts.push(`${name}="${escapeAttribute(value)}"`)
  }

  return parts.join(" ")
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
