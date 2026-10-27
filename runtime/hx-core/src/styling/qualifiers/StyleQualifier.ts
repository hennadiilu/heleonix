import type { IQualifierUsage } from "@heleonix/hx-language"
import type { IBindingScope } from "./IBindingScope"
import type { IStyleEffect } from "../../platform/IStyleEffect"
import type { StyleCondition } from "../StyleCondition"
import type { IDisposable } from "../../common/IDisposable"
import type { MaybePromise } from "../../common/MaybePromise"

export abstract class StyleQualifier<TArgs = object> {
  // The typed argument contract - read by the analyzer's class scan, never at
  // runtime. `declare` keeps it type-only, with no field emitted.
  declare protected readonly args: TArgs

  public build?(usage: IQualifierUsage): StyleCondition | undefined

  public attach?(usage: IQualifierUsage, scope: IBindingScope, effect: IStyleEffect): MaybePromise<IDisposable>
}
