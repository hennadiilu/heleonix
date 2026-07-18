import type { IConfigDefinition } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { ConfigDefinitionSource } from "./ConfigDefinitionSource"
import { DimensionManager } from "../dimension/DimensionManager"
import { FrameworkElement } from "../FrameworkElement"
import { ConfigSelectionStrategy } from "./ConfigSelectionStrategy"
import { IDIContainer } from "../injection/IDIContainer"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { IConfigDefinitionProviderSettings } from "./IConfigDefinitionProviderSettings"
import { InjectableType } from "../injection/InjectableType"

export class ConfigDefinitionProvider extends FrameworkElement<ConfigDefinitionSource | DimensionManager> {
  protected readonly dimensionManager = this.inject(DimensionManager)

  protected readonly sources: ConfigDefinitionSource[] = []

  protected readonly selectionStrategy: ConfigSelectionStrategy

  protected readonly cache = new Map<string, IConfigDefinition | undefined>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const internalDIContainer = diContainer as IDIContainerInternal

    const settings = internalDIContainer.getSettings<IConfigDefinitionProviderSettings>(
      (this.constructor as InjectableType).diName,
    )

    this.selectionStrategy = settings.selectionStrategy ?? ConfigSelectionStrategy.Layered

    for (const source of settings.sources) {
      this.sources.push(internalDIContainer.inject(source.diName))
    }
  }

  public static get diName(): string {
    return "ConfigDefinitionProvider"
  }

  public async getDefinition(name: string): Promise<IConfigDefinition | undefined> {
    const key = `${name}.${this.dimensionManager.dimensionString}`

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const merged =
      this.selectionStrategy === ConfigSelectionStrategy.Layered
        ? await this.mergeLayered(name)
        : mergeDimensions(
            await this.getApplicableDefinitions(name),
            this.dimensionManager.currentDimension,
            this.dimensionManager.dimensionDefinitions,
            this.mergeDeeply,
            "extend",
          )

    this.cache.set(key, merged)

    return merged
  }

  protected async mergeLayered(name: string): Promise<IConfigDefinition | undefined> {
    let merged: IConfigDefinition | undefined

    for (const source of this.sources) {
      const definitions = await source.getDefinitions(name, this.dimensionManager.currentDimension)

      merged = mergeDimensions(
        definitions,
        this.dimensionManager.currentDimension,
        this.dimensionManager.dimensionDefinitions,
        this.mergeDeeply,
        "extend",
        merged,
      )
    }

    return merged
  }

  protected async getApplicableDefinitions(name: string): Promise<readonly IConfigDefinition[]> {
    switch (this.selectionStrategy) {
      case ConfigSelectionStrategy.All: {
        const all: IConfigDefinition[] = []

        for (const source of this.sources) {
          all.push(...(await source.getDefinitions(name, this.dimensionManager.currentDimension)))
        }

        return all
      }
      case ConfigSelectionStrategy.Last: {
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

  private mergeDeeply = (base: IConfigDefinition | undefined, extension: IConfigDefinition): IConfigDefinition => {
    const result: IConfigDefinition = base ?? {
      name: extension.name,
      usage: extension.usage,
      dimension: { ...extension.dimension },
      entries: {},
    }

    Merger.mergeDeeply(result.entries, extension.entries)

    return result
  }
}
