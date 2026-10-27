import type { IThemeDefinition } from "@heleonix/hx-language"
import { mergeDimensions } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { AggregateDefinitionSource } from "../definitions/AggregateDefinitionSource"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IClearable } from "../common/IClearable"

export class ThemeDefinitionLoader implements IClearable {
  protected readonly themes = new Map<string, IThemeDefinition | undefined>()

  public constructor(
    protected readonly dimensions: IDimensionProvider,
    protected readonly sources: readonly AggregateDefinitionSource<IThemeDefinition>[],
  ) {}

  public async loadTheme(): Promise<IThemeDefinition | undefined> {
    const key = this.dimensions.currentKey

    if (this.themes.has(key)) {
      return this.themes.get(key)
    }

    let merged: IThemeDefinition | undefined

    for (const source of this.sources) {
      const definitions = await source.loadDefinitions(this.dimensions.current)

      merged = mergeDimensions(
        definitions,
        this.dimensions.current,
        this.dimensions.definitions,
        (mergeBase, extension) => this.mergeDeeply(mergeBase, extension),
        "extend",
        merged,
      )
    }

    this.themes.set(key, merged)

    return merged
  }

  public clear(): void {
    this.themes.clear()
  }

  protected mergeDeeply(base: IThemeDefinition | undefined, extension: IThemeDefinition): IThemeDefinition {
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
