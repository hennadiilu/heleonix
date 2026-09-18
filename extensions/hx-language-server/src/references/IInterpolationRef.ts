import type { BindingType } from "@heleonix/hx-language"

export interface IInterpolationRef {
  kind: BindingType

  name?: string

  entry?: string

  start: number

  end: number
}
