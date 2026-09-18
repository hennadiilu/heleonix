import type { BindingType } from "@heleonix/hx-language"

export interface IValueSource {
  readonly type: BindingType

  get(path: string): unknown
}
