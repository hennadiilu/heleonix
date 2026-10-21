import type { IDimensionDefinition } from "@heleonix/hx-language"
import type { DiagnosticLevel } from "./DiagnosticLevel"
import type { IHxConfigPatterns } from "./IHxConfigPatterns"
import type { IHxConfigResult } from "./IHxConfigResult"

/** What a build of a package compiles, and how it reports - its options over its `hx.config.json`. */
export interface IHxBuildSettings {
  /** The configuration lookup: the files to watch, and why it failed when it did. */
  lookup: IHxConfigResult

  /** Absolute directories holding the sources. */
  include: string[]

  /** Folder names, or absolute paths. */
  exclude: string[]

  dimensions: IDimensionDefinition[]

  severity: Record<string, DiagnosticLevel>

  failOnWarnings: boolean

  /** TypeScript sources left out of class discovery. */
  typescriptExclude?: IHxConfigPatterns
}
