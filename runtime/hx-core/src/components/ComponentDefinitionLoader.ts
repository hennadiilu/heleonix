import type { DimensionUsage, IComponentDefinition } from "@heleonix/hx-language"
import { DefinitionLoader } from "../definitions/DefinitionLoader"

export class ComponentDefinitionLoader extends DefinitionLoader<IComponentDefinition> {
  protected readonly defaultUsage: DimensionUsage = "override"

  protected override mergeMatches(
    definitions: readonly IComponentDefinition[],
    base?: IComponentDefinition,
  ): IComponentDefinition | undefined {
    return super.mergeMatches([...definitions].reverse(), base)
  }

  protected mergeDeeply(
    _base: IComponentDefinition | undefined,
    extension: IComponentDefinition,
  ): IComponentDefinition {
    return extension
  }
}
