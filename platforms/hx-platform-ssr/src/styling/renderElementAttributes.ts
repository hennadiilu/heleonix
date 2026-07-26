import type { SsrElementState } from "./SsrElementState"

/**
 * Serializes a component's accumulated {@link SsrElementState} into the styling
 * attributes of its opening tag - `class`, then `style` (`--hx-*` variables and
 * properties), then any `data-*` gate attributes, each in write order. Empty
 * groups are omitted; the result is deterministic so a client re-render produces
 * the same markup (hydration idempotence). Values are assumed attribute-safe
 * (content-hashed classes, mangled variable names, framework-generated gates).
 */
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
