import type { IDictionaryDefinition } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { DictionaryDefinitionSource } from "./DictionaryDefinitionSource"
import { DimensionManager } from "../dimension/DimensionManager"
import { FrameworkElement } from "../FrameworkElement"
import { DictionarySelectionStrategy } from "./DictionarySelectionStrategy"
import { IDIContainer } from "../injection/IDIContainer"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { IDictionaryDefinitionProviderSettings } from "./IDictionaryDefinitionProviderSettings"
import { InjectableType } from "../injection/InjectableType"

export class DictionaryDefinitionProvider extends FrameworkElement<DictionaryDefinitionSource | DimensionManager> {
  protected readonly dimensionManager = this.inject(DimensionManager)

  protected readonly sources: DictionaryDefinitionSource[] = []

  protected readonly selectionStrategy: DictionarySelectionStrategy

  protected readonly cache = new Map<string, IDictionaryDefinition | undefined>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const internalDIContainer = diContainer as IDIContainerInternal

    const settings = internalDIContainer.getSettings<IDictionaryDefinitionProviderSettings>(
      (this.constructor as InjectableType).diName,
    )

    this.selectionStrategy = settings.selectionStrategy ?? DictionarySelectionStrategy.Layered

    for (const source of settings.sources) {
      this.sources.push(internalDIContainer.inject(source.diName))
    }
  }

  public static get diName(): string {
    return "DictionaryDefinitionProvider"
  }

  public async getDefinition(name: string): Promise<IDictionaryDefinition | undefined> {
    const key = `${name}.${this.dimensionManager.dimensionString}`

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const merged =
      this.selectionStrategy === DictionarySelectionStrategy.Layered
        ? await this.mergeLayered(name)
        : mergeDimensions(
            await this.getApplicableDefinitions(name),
            this.dimensionManager.currentDimension,
            this.dimensionManager.dimensionDefinitions,
            this.mergeDeeply,
            "override",
          )

    this.cache.set(key, merged)

    return merged
  }

  protected async mergeLayered(name: string): Promise<IDictionaryDefinition | undefined> {
    let merged: IDictionaryDefinition | undefined

    for (const source of this.sources) {
      const definitions = await source.getDefinitions(name, this.dimensionManager.currentDimension)

      merged = mergeDimensions(
        definitions,
        this.dimensionManager.currentDimension,
        this.dimensionManager.dimensionDefinitions,
        this.mergeDeeply,
        "override",
        merged,
      )
    }

    return merged
  }

  protected async getApplicableDefinitions(name: string): Promise<readonly IDictionaryDefinition[]> {
    switch (this.selectionStrategy) {
      case DictionarySelectionStrategy.All: {
        const all: IDictionaryDefinition[] = []

        for (const source of this.sources) {
          all.push(...(await source.getDefinitions(name, this.dimensionManager.currentDimension)))
        }

        return all
      }
      case DictionarySelectionStrategy.Last: {
        for (let index = this.sources.length - 1; index >= 0; index--) {
          const definitions = await this.sources[index].getDefinitions(name, this.dimensionManager.currentDimension)

          if (definitions.length) {
            return definitions
          }
        }

        return []
      }
      default: {
        for (const source of this.sources) {
          const definitions = await source.getDefinitions(name, this.dimensionManager.currentDimension)

          if (definitions.length) {
            return definitions
          }
        }

        return []
      }
    }
  }

  private mergeDeeply = (
    base: IDictionaryDefinition | undefined,
    extension: IDictionaryDefinition,
  ): IDictionaryDefinition => {
    const result: IDictionaryDefinition = base ?? {
      name: extension.name,
      usage: extension.usage,
      dimension: { ...extension.dimension },
      entries: {},
    }

    Merger.mergeDeeply(result.entries, extension.entries)

    return result
  }
}
