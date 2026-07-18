import type { IComponentUsage } from "./IComponentUsage"
import type { IDimension } from "../dimensions/IDimension"

/**
 * Component definition returned by component definition providers and
 * produced by compiling `*.hxm` templates.
 */
export interface IComponentDefinition {
  tag: string

  dimension: IDimension

  type?: string

  children?: IComponentUsage[]
}
