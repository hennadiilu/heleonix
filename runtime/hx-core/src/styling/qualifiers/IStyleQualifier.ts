import type { IQualifierUsage } from "@heleonix/hx-language"
import type { IBindingScope } from "./IBindingScope"
import type { IStyleEffect } from "../../platform/IStyleEffect"
import type { StyleFragment } from "../StyleFragment"
import type { IDisposable } from "../../common/IDisposable"
import type { MaybePromise } from "../../common/MaybePromise"

export interface IStyleQualifier {
  build?(usage: IQualifierUsage): StyleFragment | undefined

  attach?(usage: IQualifierUsage, scope: IBindingScope, effect: IStyleEffect): MaybePromise<IDisposable>
}
