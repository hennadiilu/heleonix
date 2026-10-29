import type { DimensionUsage, IDictionaryDefinition } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { DefinitionLoader } from "../definitions/DefinitionLoader"

export class DictionaryDefinitionLoader extends DefinitionLoader<IDictionaryDefinition> {
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
