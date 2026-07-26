import type { IDimension } from "@heleonix/hx-language"

/**
 * One source file of the analyzed snapshot. The analyzer is filesystem-free:
 * hosts (build plugins, language servers, browser runtimes) read files and
 * parse names/dimensions themselves, so analysis runs anywhere.
 */
export interface IAnalyzerFile {
  path: string

  ext: string

  name: string

  dimension: IDimension

  source: string
}
