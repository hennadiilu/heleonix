import type { DimensionUsage, IConfigDefinition } from "@heleonix/hx-language"
import { Merger } from "@heleonix/hx-utils"
import { MergingDefinitionLoader } from "../definitions/MergingDefinitionLoader"

export class ConfigDefinitionLoader extends MergingDefinitionLoader<IConfigDefinition> {
  protected readonly defaultUsage: DimensionUsage = "extend"

  protected mergeDeeply(base: IConfigDefinition | undefined, extension: IConfigDefinition): IConfigDefinition {
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
