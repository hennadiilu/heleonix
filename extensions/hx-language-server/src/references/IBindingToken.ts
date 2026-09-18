import type { BindingTokenKind } from "./BindingTokenKind"

export interface IBindingToken {
  kind: BindingTokenKind

  start: number

  length: number
}
