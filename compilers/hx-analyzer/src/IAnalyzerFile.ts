import type { IDimension } from "@heleonix/hx-language"

export interface IAnalyzerFile {
  path: string

  ext: string

  name: string

  dimension: IDimension

  source: string
}
