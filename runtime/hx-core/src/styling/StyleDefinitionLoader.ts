import type { DimensionUsage, IStyleDefinition } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { MergingDefinitionLoader } from "../definitions/MergingDefinitionLoader"

export class StyleDefinitionLoader extends MergingDefinitionLoader<IStyleDefinition> {
  protected readonly defaultUsage: DimensionUsage = "extend"

  protected mergeDeeply(base: IStyleDefinition | undefined, extension: IStyleDefinition): IStyleDefinition {
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
