import type { BindingTokenKind } from "./BindingTokenKind"

/** A classified span within a binding expression, with offsets relative to the expression. */
export interface IBindingToken {
  kind: BindingTokenKind

  start: number

  length: number
}
