import type { SsrElementState } from "./SsrElementState"

export function renderElementAttributes(state: SsrElementState): string {
  const parts: string[] = []

  if (state.classes.size > 0) {
    parts.push(`class="${[...state.classes].join(" ")}"`)
  }

  if (state.styles.size > 0) {
    const declarations = [...state.styles].map(([property, value]) => `${property}: ${value}`).join("; ")

    parts.push(`style="${declarations}"`)
  }

  for (const [name, value] of state.attributes) {
    parts.push(`${name}="${value}"`)
  }

  return parts.join(" ")
}
