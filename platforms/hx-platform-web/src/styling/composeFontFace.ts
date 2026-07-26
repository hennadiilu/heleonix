import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "./declarationsToCss"

/** Composes one `@font-face` at-rule from a descriptor map (fonts have no name key). */
export function composeFontFace(descriptors: IStyleDeclarations): string {
  return `@font-face { ${declarationsToCss(descriptors)} }`
}
