import type { IDimensionDefinition } from "@heleonix/hx-language"

export interface IHxWebpackLoaderOptions {
  dimensions?: readonly IDimensionDefinition[]

  /** The files these options were read from (the package's configuration): a change to them recompiles the source. */
  dependencies?: readonly string[]
}
