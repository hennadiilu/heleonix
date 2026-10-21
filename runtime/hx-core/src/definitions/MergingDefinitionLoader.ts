import type { DimensionUsage, IDimension } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { DefinitionLoader } from "./DefinitionLoader"

export abstract class MergingDefinitionLoader<
  TDefinition extends { dimension: IDimension; usage?: DimensionUsage },
> extends DefinitionLoader<TDefinition> {
  protected abstract readonly defaultUsage: DimensionUsage

  protected async resolveLayeredDefinition(name: string): Promise<TDefinition | undefined> {
    let merged: TDefinition | undefined

    for (const source of this.sources) {
      merged = this.mergeMatches(await source.loadDefinitions(name, this.dimensions.current), merged)
    }

    return merged
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

  protected abstract mergeDeeply(base: TDefinition | undefined, extension: TDefinition): TDefinition
}
