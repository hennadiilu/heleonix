import { DefinitionLoader } from "./DefinitionLoader"
import { ICompiledDefinitions } from "./ICompiledDefinitions"
import { normalizeCompiledDefinitions } from "./normalizeCompiledDefinitions"

/**
 * Loads a compiled-definitions manifest from an `http(s)` endpoint. The response
 * body must be a single JSON manifest ({@link ICompiledDefinitions}); merging of
 * several endpoints is handled by registering several sources.
 */
export class HttpDefinitionLoader implements DefinitionLoader {
  public readonly id: string

  public constructor(private readonly url: string) {
    this.id = `http:${url}`
  }

  public async load(): Promise<ICompiledDefinitions> {
    const response = await fetch(this.url)

    if (!response.ok) {
      throw new Error(`${this.url} responded ${response.status} ${response.statusText}`)
    }

    return normalizeCompiledDefinitions(await response.json())
  }
}
