import type { IQualifierUsage } from "@heleonix/hx-language"
import type { IComponentState } from "./IComponentState"
import type { IStyleEffect } from "../../platform/IStyleEffect"
import type { StyleFragment } from "../StyleFragment"
import type { IDisposable } from "../../common/IDisposable"

export interface IStyleQualifier {
  build?(usage: IQualifierUsage): StyleFragment | undefined

  attach?(usage: IQualifierUsage, state: IComponentState, effect: IStyleEffect): IDisposable
}
