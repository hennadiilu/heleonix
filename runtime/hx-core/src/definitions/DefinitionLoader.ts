import type { IDimension } from "@heleonix/hx-language"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { DefinitionSource } from "./DefinitionSource"
import { DefinitionSelectionStrategy } from "./DefinitionSelectionStrategy"
import type { IClearable } from "../common/IClearable"

export abstract class DefinitionLoader<TDefinition extends { dimension: IDimension }> implements IClearable {
  protected readonly selectionStrategy: DefinitionSelectionStrategy

  protected readonly cache = new Map<string, TDefinition | undefined>()

  public constructor(
    protected readonly dimensions: IDimensionProvider,
    protected readonly sources: readonly DefinitionSource<TDefinition>[],
    selectionStrategy?: DefinitionSelectionStrategy,
  ) {
    this.selectionStrategy = selectionStrategy ?? DefinitionSelectionStrategy.Layered
  }

  public clear(): void {
    this.cache.clear()
  }

  public async loadDefinition(name: string): Promise<TDefinition | undefined> {
    const key = `${name}.${this.dimensions.currentKey}`

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const resolved =
      this.selectionStrategy === DefinitionSelectionStrategy.Layered
        ? await this.resolveLayered(name)
        : this.resolveAcrossSources(await this.getApplicableDefinitions(name))

    this.cache.set(key, resolved)

    return resolved
  }

  protected async getApplicableDefinitions(name: string): Promise<readonly TDefinition[]> {
    const dimension = this.dimensions.current

    if (this.selectionStrategy === DefinitionSelectionStrategy.All) {
      const all: TDefinition[] = []

      for (const source of this.sources) {
        all.push(...(await source.loadDefinitions(name, dimension)))
      }

      return all
    }

    const fromLast = this.selectionStrategy === DefinitionSelectionStrategy.Last

    for (let index = 0; index < this.sources.length; index++) {
      const source = this.sources[fromLast ? this.sources.length - 1 - index : index]
      const definitions = await source.loadDefinitions(name, dimension)

      if (definitions.length) {
        return definitions
      }
    }

    return []
  }

  protected abstract resolveLayered(name: string): Promise<TDefinition | undefined>

  protected abstract resolveAcrossSources(definitions: readonly TDefinition[]): TDefinition | undefined
}
