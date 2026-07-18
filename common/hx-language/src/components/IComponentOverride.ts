import type { IBindingExpression } from "../bindings/IBindingExpression"
import type { IComponentUsage } from "./IComponentUsage"

/**
 * A `target:Component` override declared on a component usage. The target is a
 * dot-separated chain resolved inside the used component's definition: each
 * segment matches a named control or a component tag, and every segment except
 * the last descends one definition scope deeper.
 *
 * At most one of `binding`/`children` provides the replacement: `binding`
 * resolves to the name of the replacement component (a bare name directly, or a
 * dictionary/config reference through its entry value); `children` is an inline
 * definition. Neither present means the target renders nothing.
 */
export interface IComponentOverride {
  target: string

  binding?: IBindingExpression

  children?: IComponentUsage[]
}
