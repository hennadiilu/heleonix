import { pathToFileURL } from "node:url"
import { DefinitionLoader } from "./DefinitionLoader"
import { ICompiledDefinitions } from "./ICompiledDefinitions"

/**
 * Advanced escape hatch: loads compiled definitions from a user-supplied loader
 * *module* in the workspace. The module exports (as `default` or `loader`) an
 * object implementing {@link DefinitionLoader}, or a sync/async factory that
 * returns one; its `load()` yields the {@link ICompiledDefinitions} that the
 * shared projector then indexes. Because the custom module only ever produces
 * the public compiled-definitions manifest (typed by `@heleonix/hx-language`),
 * it never depends on the server's internal index shape.
 *
 * This is the only definition-source path that executes workspace code, so the
 * server instantiates it only for trusted workspaces. Must be a built module
 * (`.js`/`.mjs`/`.cjs`) - the server does not transpile TypeScript.
 */
export class ModuleDefinitionLoader implements DefinitionLoader {
  public readonly id: string

  public constructor(private readonly absolutePath: string) {
    this.id = `module:${absolutePath}`
  }

  public async load(): Promise<ICompiledDefinitions> {
    const module = (await import(pathToFileURL(this.absolutePath).href)) as Record<string, unknown>
    const exported = module.default ?? module.loader ?? module
    // Support an instance or a (sync/async) factory. A bare class would need
    // `new`, which can't be told apart reliably, so authors export `new X()` or
    // a factory instead.
    const loader = (typeof exported === "function" ? await (exported as () => unknown)() : exported) as
      | Partial<DefinitionLoader>
      | undefined

    if (typeof loader?.load !== "function") {
      throw new Error(`module '${this.absolutePath}' does not export a DefinitionLoader (missing load())`)
    }

    return loader.load()
  }
}
