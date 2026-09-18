import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "./declarationsToCss"

export function composeKeyframes(name: string, frames: Readonly<Record<string, IStyleDeclarations>>): string {
  const body = Object.entries(frames)
    .map(([selector, declarations]) => `${selector} { ${declarationsToCss(declarations)} }`)
    .join(" ")

  return `@keyframes ${name} { ${body} }`
}
