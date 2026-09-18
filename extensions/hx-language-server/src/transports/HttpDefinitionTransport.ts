import { IDefinitionTransport } from "./IDefinitionTransport"
import { ICompiledDefinitions } from "./ICompiledDefinitions"
import { normalizeCompiledDefinitions } from "./normalizeCompiledDefinitions"

export class HttpDefinitionTransport implements IDefinitionTransport {
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
