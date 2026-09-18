import type { IDimension } from "../dimensions/IDimension"
import type { IMemberType } from "../members/IMemberType"

export interface IComponentMetaEntry {
  name: string

  dimension: IDimension

  docs?: string

  props?: IMemberType[]

  events?: IMemberType[]

  controls?: string[]

  open?: boolean
}
