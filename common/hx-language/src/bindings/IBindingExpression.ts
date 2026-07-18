import type { BindingType } from "./BindingType"

export interface IBindingExpression {
  type: BindingType

  value: string

  converters?: string[]
}
