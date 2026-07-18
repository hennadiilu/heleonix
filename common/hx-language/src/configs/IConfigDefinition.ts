import type { IConfigEntryDefinition } from "./IConfigEntryDefinition"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

export interface IConfigDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  entries: IConfigEntryDefinition
}
