import type { IStyleDeclarations } from "@heleonix/hx-language"
import { declarationsToCss } from "../styling/declarationsToCss"

export function composeCounterStyle(name: string, descriptors: IStyleDeclarations): string {
  return `@counter-style ${name} { ${declarationsToCss(descriptors)} }`
}
