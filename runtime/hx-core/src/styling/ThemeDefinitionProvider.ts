import type { IThemeDefinition } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { ThemeDefinitionSource } from "./ThemeDefinitionSource"
import { DimensionManager } from "../dimension/DimensionManager"
import { FrameworkElement } from "../FrameworkElement"
import { IDIContainer } from "../injection/IDIContainer"
import { IDIContainerInternal } from "../injection/IDIContainerInternal"
import { IThemeDefinitionProviderSettings } from "./IThemeDefinitionProviderSettings"
import { InjectableType } from "../injection/InjectableType"

/**
 * Aggregates every `*.hxt` partial across sources and dimension overlays into the
 * single application theme (groups/keyframes/counter-styles deep-merged,
 * font-faces concatenated). Partials with no `usage` default to `extend`, so a
 * later source's tokens layer onto (and override per-leaf) earlier ones. A pure
 * function of the current dimension - deterministic for SSR. Cached per dimension.
 */
export class ThemeDefinitionProvider extends FrameworkElement<ThemeDefinitionSource | DimensionManager> {
  protected readonly dimensionManager = this.inject(DimensionManager)

  protected readonly sources: ThemeDefinitionSource[] = []

  protected readonly cache = new Map<string, IThemeDefinition | undefined>()

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    const internalDIContainer = diContainer as IDIContainerInternal
    const settings = internalDIContainer.getSettings<IThemeDefinitionProviderSettings>(
      (this.constructor as InjectableType).diName,
    )

    for (const source of settings.sources) {
      this.sources.push(internalDIContainer.inject(source.diName))
    }
  }

  public static get diName(): string {
    return "ThemeDefinitionProvider"
  }

  public async getTheme(): Promise<IThemeDefinition | undefined> {
    const key = this.dimensionManager.dimensionString

    if (this.cache.has(key)) {
      return this.cache.get(key)
    }

    let merged: IThemeDefinition | undefined

    for (const source of this.sources) {
      const definitions = await source.getDefinitions(this.dimensionManager.currentDimension)

      merged = mergeDimensions(
        definitions,
        this.dimensionManager.currentDimension,
        this.dimensionManager.dimensionDefinitions,
        this.mergeDeeply,
        "extend",
        merged,
      )
    }

    this.cache.set(key, merged)

    return merged
  }

  private mergeDeeply = (base: IThemeDefinition | undefined, extension: IThemeDefinition): IThemeDefinition => {
    const result: IThemeDefinition = base ?? { name: "", dimension: { ...extension.dimension }, groups: {} }

    Merger.mergeDeeply(result.groups, extension.groups)

    if (extension.keyframes) {
      result.keyframes = Merger.mergeDeeply(result.keyframes ?? {}, extension.keyframes)
    }

    if (extension.counterStyles) {
      result.counterStyles = Merger.mergeDeeply(result.counterStyles ?? {}, extension.counterStyles)
    }

    if (extension.fontFaces) {
      result.fontFaces = [...(result.fontFaces ?? []), ...extension.fontFaces]
    }

    return result
  }
}
