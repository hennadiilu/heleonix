import type { DimensionUsage, IDimension } from "@heleonix/hx-language"
import { matchDimension, mergeDimensions } from "@heleonix/hx-language"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { DefinitionSource } from "./DefinitionSource"
import { DefinitionSelectionStrategy } from "./DefinitionSelectionStrategy"
import type { IClearable } from "../common/IClearable"

export abstract class DefinitionLoader<
  TDefinition extends { dimension: IDimension; usage?: DimensionUsage },
> implements IClearable {
  protected readonly selectionStrategy: DefinitionSelectionStrategy

  protected readonly definitions = new Map<string, TDefinition | undefined>()

  protected abstract readonly defaultUsage: DimensionUsage

  public constructor(
    protected readonly dimensions: IDimensionProvider,
    protected readonly sources: readonly DefinitionSource<TDefinition>[],
    selectionStrategy?: DefinitionSelectionStrategy,
  ) {
    this.selectionStrategy = selectionStrategy ?? DefinitionSelectionStrategy.Layered
  }

  public clear(): void {
    this.definitions.clear()
  }

  public async loadDefinition(name: string): Promise<TDefinition | undefined> {
    const key = `${name}.${this.dimensions.currentKey}`

    if (this.definitions.has(key)) {
      return this.definitions.get(key)
    }

    const resolvedDefinition =
      this.selectionStrategy === DefinitionSelectionStrategy.Layered
        ? await this.resolveLayeredDefinition(name)
        : this.resolveDefinitionsAcrossSources(await this.getApplicableDefinitions(name))

    this.definitions.set(key, resolvedDefinition)

    return resolvedDefinition
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

  protected async resolveLayeredDefinition(name: string): Promise<TDefinition | undefined> {
    const layers: (readonly TDefinition[])[] = []

    for (let index = this.sources.length - 1; index >= 0; index--) {
      const definitions = await this.sources[index].loadDefinitions(name, this.dimensions.current)

      layers.push(definitions)

      if (definitions.some((definition) => this.replacesLowerLayers(definition))) {
        break
      }
    }

    return layers.reduceRight<TDefinition | undefined>(
      (merged, definitions) => this.mergeMatches(definitions, merged),
      undefined,
    )
  }

  protected resolveDefinitionsAcrossSources(definitions: readonly TDefinition[]): TDefinition | undefined {
    return this.mergeMatches(definitions)
  }

  protected mergeMatches(definitions: readonly TDefinition[], base?: TDefinition): TDefinition | undefined {
    return mergeDimensions(
      definitions,
      this.dimensions.current,
      this.dimensions.definitions,
      (mergeBase, extension) => this.mergeDeeply(mergeBase, extension),
      this.defaultUsage,
      base,
    )
  }

  protected replacesLowerLayers(definition: TDefinition): boolean {
    return (
      (definition.usage ?? this.defaultUsage) === "override" &&
      matchDimension(definition.dimension, this.dimensions.current, this.dimensions.definitions) !== undefined
    )
  }

  protected abstract mergeDeeply(base: TDefinition | undefined, extension: TDefinition): TDefinition
}
