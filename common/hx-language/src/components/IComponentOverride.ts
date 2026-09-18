import type { IBindingExpression } from "../bindings/IBindingExpression"
import type { IComponentUsage } from "./IComponentUsage"

export interface IComponentOverride {
  target: string

  binding?: IBindingExpression

  children?: IComponentUsage[]
}
