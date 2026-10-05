import type { IBindingExpression } from "@heleonix/hx-language"
import type { MaybePromise } from "../../common/MaybePromise"

export interface IBindingScope {
  resolve(binding: IBindingExpression): MaybePromise<unknown>

  subscribe(binding: IBindingExpression, handler: () => void): MaybePromise<() => void>
}
