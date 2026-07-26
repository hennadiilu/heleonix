import type { IStyleDefinition } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { StyleDefinitionSource } from "./StyleDefinitionSource"
import { StyleSelectionStrategy } from "./StyleSelectionStrategy"
import { DimensionManager } from "../dimension/DimensionManager"
import { FrameworkElement } from "../FrameworkElement"
import { IDIContainer } from "../injection/IDIContainer"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { IStyleDefinitionProviderSettings } from "./IStyleDefinitionProviderSettings"
import { InjectableType } from "../injection/InjectableType"

/**
 * Merges a component's compiled `*.hxs` definitions across sources and dimension
 * overlays into one {@link IStyleDefinition} (rules/keyframes/applies deep-merged
 * per-declaration). Styles always merge per-declaration - a definition with no
 * `usage` defaults to `extend`, so later sources/overlays layer onto earlier ones
 * (drop an inherited declaration with a CSS reset value, not by replacing). The
 * result is a pure function of the current dimension, so it is deterministic - the
 * same on the server (SSR) and the client. Cached per name + dimension.
 */
export class StyleDefinitionProvider extends FrameworkElement<StyleDefinitionSource | DimensionManager> {
  protected readonly dimensionManager = this.inject(DimensionManager)

  protected readonly sources: StyleDefinitionSource[] = []

  protected readonly selectionStrategy: StyleSelectionStrategy

  protected readonly cache = new Map<string, IStyleDefinition | undefined>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const internalDIContainer = diContainer as IDIContainerInternal
    const settings = internalDIContainer.getSettings<IStyleDefinitionProviderSettings>(
      (this.constructor as InjectableType).diName,
    )

    this.selectionStrategy = settings.selectionStrategy ?? StyleSelectionStrategy.Layered

    for (const source of settings.sources) {
      this.sources.push(internalDIContainer.inject(source.diName))
    }
  }

  public static get diName(): string {
    return "StyleDefinitionProvider"
  }

  public async getDefinition(name: string): Promise<IStyleDefinition | undefined> {
    const key = `${name}.${this.dimensionManager.dimensionString}`

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    const merged =
      this.selectionStrategy === StyleSelectionStrategy.Layered
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

  protected async mergeLayered(name: string): Promise<IStyleDefinition | undefined> {
    let merged: IStyleDefinition | undefined

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

  protected async getApplicableDefinitions(name: string): Promise<readonly IStyleDefinition[]> {
    switch (this.selectionStrategy) {
      case StyleSelectionStrategy.All: {
        const all: IStyleDefinition[] = []

        for (const source of this.sources) {
          all.push(...(await source.getDefinitions(name, this.dimensionManager.currentDimension)))
        }

        return all
      }
      case StyleSelectionStrategy.Last: {
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

  private mergeDeeply = (base: IStyleDefinition | undefined, extension: IStyleDefinition): IStyleDefinition => {
    const result: IStyleDefinition = base ?? {
      name: extension.name,
      usage: extension.usage,
      dimension: { ...extension.dimension },
      rules: {},
    }

    Merger.mergeDeeply(result.rules, extension.rules)

    if (extension.keyframes) {
      result.keyframes = Merger.mergeDeeply(result.keyframes ?? {}, extension.keyframes)
    }

    if (extension.applies) {
      result.applies = Merger.mergeDeeply(result.applies ?? {}, extension.applies)
    }

    return result
  }
}
