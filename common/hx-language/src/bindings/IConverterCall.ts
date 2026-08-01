import type { IBindingExpression } from "./IBindingExpression"

/**
 * One converter in a pipe chain, parsed from a raw segment such as
 * `Truncate(length: 10, ellipsis: 'dots')`: the registry `name` and its
 * named arguments, each an ordinary binding source (state/dictionary/config/
 * literal). A bare converter (`Truncate`) has an empty `args`.
 */
export interface IConverterCall {
  name: string

  args: Record<string, IBindingExpression>
}
