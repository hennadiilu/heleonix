import type { IComponentDefinition } from "@heleonix/hx-language"
import { selectDimensions } from "@heleonix/hx-language"
import { IDIContainer } from "../injection/IDIContainer"
import { FrameworkComponentDefinitionSource } from "./FrameworkComponentDefinitionSource"
import { ComponentDefinitionSource } from "./ComponentDefinitionSource"
import { DimensionManager } from "../dimension/DimensionManager"
import { FrameworkElement } from "../FrameworkElement"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { InjectableType } from "../injection/InjectableType"
import { IComponentDefinitionProviderSettings } from "./IComponentDefinitionProviderSettings"
import { ComponentSelectionStrategy } from "./ComponentSelectionStrategy"

export class ComponentDefinitionProvider extends FrameworkElement<ComponentDefinitionSource | DimensionManager> {
  protected readonly dimensionManager = this.inject(DimensionManager)

  protected readonly sources: ComponentDefinitionSource[] = [this.inject(FrameworkComponentDefinitionSource)]

  protected readonly selectionStrategy: ComponentSelectionStrategy

  protected readonly cache = new Map<string, IComponentDefinition | undefined>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const internalDIContainer = diContainer as IDIContainerInternal

    const settings = internalDIContainer.getSettings<IComponentDefinitionProviderSettings>(
      (this.constructor as InjectableType).diName,
    )

    this.selectionStrategy = settings.selectionStrategy ?? ComponentSelectionStrategy.Layered

    for (const source of settings.sources) {
      this.sources.push(internalDIContainer.inject(source.diName))
    }
  }

  public static get diName(): string {
    return "ComponentDefinitionProvider"
  }

  public async getDefinition(name: string): Promise<IComponentDefinition | undefined> {
    const key = `${name}.${this.dimensionManager.dimensionString}`

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const selected =
      this.selectionStrategy === ComponentSelectionStrategy.Layered
        ? await this.selectLayered(name)
        : selectDimensions(
            await this.getApplicableDefinitions(name),
            this.dimensionManager.currentDimension,
            this.dimensionManager.dimensionDefinitions,
          )

    this.cache.set(key, selected)

    return selected
  }

  protected async selectLayered(name: string): Promise<IComponentDefinition | undefined> {
    // A layer whose definitions exist but don't match the current dimension falls
    // through to the layer below, unlike the Last strategy.
    for (let index = this.sources.length - 1; index >= 0; index--) {
      const definitions = await this.sources[index].getDefinitions(name, this.dimensionManager.currentDimension)

      const selected = selectDimensions(
        definitions,
        this.dimensionManager.currentDimension,
        this.dimensionManager.dimensionDefinitions,
      )

      if (selected) {
        return selected
      }
    }

    return undefined
  }

  protected async getApplicableDefinitions(name: string): Promise<readonly IComponentDefinition[]> {
    switch (this.selectionStrategy) {
      case ComponentSelectionStrategy.All: {
        const all: IComponentDefinition[] = []

        for (const source of this.sources) {
          all.push(...(await source.getDefinitions(name, this.dimensionManager.currentDimension)))
        }

        return all
      }
      case ComponentSelectionStrategy.Last: {
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
}
