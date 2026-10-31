import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "../styling/declarationsToCss"

export function composeFontFace(descriptors: IStyleDeclarations): string {
  return `@font-face { ${declarationsToCss(descriptors)} }`
}
