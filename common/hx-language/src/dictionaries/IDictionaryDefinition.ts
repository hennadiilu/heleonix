import type { IDictionaryEntryDefinition } from "./IDictionaryEntryDefinition"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

export interface IDictionaryDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  entries: IDictionaryEntryDefinition
}
