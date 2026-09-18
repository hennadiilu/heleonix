import type { IBindingExpression } from "./IBindingExpression"

export interface IConverterCall {
  name: string

  args: Record<string, IBindingExpression>
}
