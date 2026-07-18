import type { IDictionaryEntryDefinition } from "./IDictionaryEntryDefinition"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

/**
 * Compiled `*.hxd` dictionary. `DimensionUsage` is set by the compiler; runtimes
 * that do not perform dimension merging can ignore it.
 */
export interface IDictionaryDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  entries: IDictionaryEntryDefinition
}
