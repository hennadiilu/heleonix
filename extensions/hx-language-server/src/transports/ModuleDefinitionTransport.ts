import { pathToFileURL } from "node:url"
import { IDefinitionTransport } from "./IDefinitionTransport"
import { ICompiledDefinitions } from "./ICompiledDefinitions"

export class ModuleDefinitionTransport implements IDefinitionTransport {
  public readonly id: string

  public constructor(private readonly absolutePath: string) {
    this.id = `module:${absolutePath}`
  }

  public async load(): Promise<ICompiledDefinitions> {
    const module = (await import(pathToFileURL(this.absolutePath).href)) as Record<string, unknown>
    const exported = module.default ?? module.transport ?? module
    // Support an instance or a (sync/async) factory. A bare class would need
    // `new`, which can't be told apart reliably, so authors export `new X()` or
    // a factory instead.
    const transport = (typeof exported === "function" ? await (exported as () => unknown)() : exported) as
      | Partial<IDefinitionTransport>
      | undefined

    if (typeof transport?.load !== "function") {
      throw new Error(`module '${this.absolutePath}' does not export a definition transport (missing load())`)
    }

    return transport.load()
  }
}
