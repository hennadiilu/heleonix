import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "./declarationsToCss"

/**
 * Composes an `@keyframes` at-rule from a timeline: frame selector
 * (`from`/`to`/`50%`/`from, to`) -> declarations, each value interpolated to
 * `var()`/`calc()` chains. The caller passes the final (already scoped) name.
 */
export function composeKeyframes(name: string, frames: Readonly<Record<string, IStyleDeclarations>>): string {
  const body = Object.entries(frames)
    .map(([selector, declarations]) => `${selector} { ${declarationsToCss(declarations)} }`)
    .join(" ")

  return `@keyframes ${name} { ${body} }`
}
