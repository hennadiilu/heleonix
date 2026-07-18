import type { IDimension } from "../dimensions/IDimension"
import type { Kind } from "../extensions/Kind"
import type { IDocs } from "./IDocs"

/**
 * Documentation of one compiled definition, shipped separately from the
 * definition itself (runtime payloads never carry docs). `kind` + `name` +
 * `dimension` is the join key back to the definition, mirroring how the
 * definitions themselves are identified.
 */
export interface IDocsEntry {
  kind: Kind

  name: string

  dimension: IDimension

  docs: IDocs
}
