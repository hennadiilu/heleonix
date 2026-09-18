import type { IBindingExpression } from "./IBindingExpression"

export function stringLiteralExpression(text: string): IBindingExpression {
  return { type: "literal", value: JSON.stringify(text) }
}
