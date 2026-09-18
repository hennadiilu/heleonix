import type { DimensionUsage, IDictionaryDefinition } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { MergingDefinitionLoader } from "../definitions/MergingDefinitionLoader"

export class DictionaryDefinitionLoader extends MergingDefinitionLoader<IDictionaryDefinition> {
  protected readonly defaultUsage: DimensionUsage = "override"

  protected mergeDeeply(
    base: IDictionaryDefinition | undefined,
    extension: IDictionaryDefinition,
  ): IDictionaryDefinition {
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
