import { DefinitionLoader } from "../loaders/DefinitionLoader"
import { IDefinitionSource } from "./IDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"
import { projectCompiledDefinitions } from "./projectCompiledDefinitions"

/**
 * A definition source backed by *compiled* definitions from anywhere - an
 * installed package, an `http(s)` endpoint, or a local file/directory. It pairs
 * a {@link DefinitionLoader} (the transport) with {@link projectCompiledDefinitions}
 * (the read-time projection into the index), so every provenance shares one
 * projection and end users only ever point at compiled artifacts, never at the
 * internal {@link IIndexContribution} shape.
 *
 * Location-less by design in v1: it powers completion, unknown-binding
 * diagnostics and workspace-wide find-references, but not go-to-definition into
 * the source (there are no `occurrences`).
 */
export class CompiledDefinitionSource implements IDefinitionSource {
  public readonly id: string

  public constructor(private readonly loader: DefinitionLoader) {
    this.id = loader.id
  }

  public async load(): Promise<IIndexContribution> {
    return projectCompiledDefinitions(await this.loader.load())
  }
}
