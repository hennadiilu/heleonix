import type { DimensionUsage, IThemeDefinition } from "@heleonix/hx-language"
import { THEME_DEFINITION_NAME } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { DefinitionLoader } from "../definitions/DefinitionLoader"

export class ThemeDefinitionLoader extends DefinitionLoader<IThemeDefinition> {
  protected readonly defaultUsage: DimensionUsage = "extend"

  public loadTheme(): Promise<IThemeDefinition | undefined> {
    return this.loadDefinition(THEME_DEFINITION_NAME)
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
