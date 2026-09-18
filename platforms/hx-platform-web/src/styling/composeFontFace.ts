import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "./declarationsToCss"

export function composeFontFace(descriptors: IStyleDeclarations): string {
  return `@font-face { ${declarationsToCss(descriptors)} }`
}
