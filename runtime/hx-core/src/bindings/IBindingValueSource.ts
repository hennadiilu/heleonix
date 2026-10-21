import type { BindingType } from "@heleonix/hx-language"

export interface IBindingValueSource {
  readonly type: BindingType

  get(path: string): unknown
}
