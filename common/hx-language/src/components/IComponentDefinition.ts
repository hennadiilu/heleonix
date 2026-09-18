import type { IComponentUsage } from "./IComponentUsage"
import type { IDimension } from "../dimensions/IDimension"

export interface IComponentDefinition {
  tag: string

  dimension: IDimension

  type?: string

  children?: IComponentUsage[]
}
