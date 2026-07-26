import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "./declarationsToCss"

/** Composes a `@counter-style` at-rule from a counter name and its descriptors. */
export function composeCounterStyle(name: string, descriptors: IStyleDeclarations): string {
  return `@counter-style ${name} { ${declarationsToCss(descriptors)} }`
}
