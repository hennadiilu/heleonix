import type { IThemeNode } from "./IThemeNode"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

/**
 * Compiled `*.hxt` theme.
 */
export interface IThemeDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  groups: Record<string, IThemeNode>
}
