import type { IDimension } from "../dimensions/IDimension"
import type { Kind } from "../extensions/Kind"
import type { IDocs } from "./IDocs"

export interface IDocsEntry {
  kind: Kind

  name: string

  dimension: IDimension

  docs: IDocs
}
