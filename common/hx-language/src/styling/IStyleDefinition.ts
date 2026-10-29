import type { IStyleDeclarations } from "./IStyleDeclarations"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

export interface IStyleDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  rules: Record<string, IStyleDeclarations>

  keyframes?: Record<string, Record<string, IStyleDeclarations>>

  applies?: Record<string, string[]>
}
