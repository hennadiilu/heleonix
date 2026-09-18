import type { IComponentDefinition } from "@heleonix/hx-language"
import { selectByDimensions } from "@heleonix/hx-language"
import { DefinitionLoader } from "../definitions/DefinitionLoader"

export class ComponentDefinitionLoader extends DefinitionLoader<IComponentDefinition> {
  protected async resolveLayered(name: string): Promise<IComponentDefinition | undefined> {
    // A layer whose definitions exist but don't match the current dimension falls
    // through to the layer below, unlike the Last strategy.
    for (let index = this.sources.length - 1; index >= 0; index--) {
      const definitions = await this.sources[index].loadDefinitions(name, this.dimensions.current)
      const selected = this.resolveAcrossSources(definitions)

      if (selected) {
        return selected
      }
    }

    return undefined
  }

  protected resolveAcrossSources(definitions: readonly IComponentDefinition[]): IComponentDefinition | undefined {
    return selectByDimensions(definitions, this.dimensions.current, this.dimensions.definitions)
  }
}
