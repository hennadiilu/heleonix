import type { IThemeGroup } from "./IThemeGroup"
import type { IStyleDeclarations } from "../styles/IStyleDeclarations"
import type { IDimension } from "../dimensions/IDimension"
import type { DimensionUsage } from "../dimensions/DimensionUsage"

export interface IThemeDefinition {
  name: string

  dimension: IDimension

  usage?: DimensionUsage

  groups: IThemeGroup

  keyframes?: Record<string, Record<string, IStyleDeclarations>>

  fontFaces?: IStyleDeclarations[]

  counterStyles?: Record<string, IStyleDeclarations>
}
