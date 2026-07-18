import type { IStyleRule } from "./IStyleRule"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

/**
 * Compiled `*.hxs` style.
 */
export interface IStyleDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  rules: IStyleRule[]
}
