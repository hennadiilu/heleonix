import type { StyleCondition } from "../styling/StyleCondition"

export interface IStyleRule {
  readonly id: string

  readonly conditions: readonly StyleCondition[]

  readonly declarations: Readonly<Record<string, string>>
}
