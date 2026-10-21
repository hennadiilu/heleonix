import type { IDimensionDefinition } from "@heleonix/hx-language"

/** What a bundler plugin's own options may set - each wins over the package's `hx.config.json`. */
export interface IHxBuildOptions {
  /** The directories holding the sources to compile, relative to the build's context. */
  include?: string | string[]

  /** Folder names skipped anywhere, or paths relative to the build's context. */
  exclude?: string | string[]

  dimensions?: readonly IDimensionDefinition[]

  failOnWarnings?: boolean
}
