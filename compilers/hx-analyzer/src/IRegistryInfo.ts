import type { IMemberType } from "./IMemberType"

/**
 * A converter/action known to the analyzer, for editor features (completion,
 * hover, go-to-implementation). Discovered TypeScript classes carry a source
 * location (`file`/`line`/`character`) and docs; entries delivered through a
 * dependency's `hx.meta.json` carry only their name and params.
 */
export interface IRegistryInfo {
  name: string

  params: IMemberType[]

  docs?: string

  file?: string

  line?: number

  character?: number
}
