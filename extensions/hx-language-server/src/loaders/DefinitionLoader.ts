import { ICompiledDefinitions } from "./ICompiledDefinitions"

/**
 * Transport behind a {@link CompiledDefinitionSource}: it knows only *where* the
 * compiled definitions come from (a local file/dir, an `http(s)` endpoint, an
 * installed package) and returns them as an {@link ICompiledDefinitions}
 * manifest. Projection into the index is done by the source, so a new
 * provenance is a new loader and nothing else.
 */
export interface DefinitionLoader {
  /** Stable identifier, used as the source id and in error messages. */
  readonly id: string

  load(): Promise<ICompiledDefinitions>
}
