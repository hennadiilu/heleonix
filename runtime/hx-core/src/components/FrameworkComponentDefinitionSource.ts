import type { IComponentDefinition, IDimension } from "@heleonix/hx-language"
import { DefinitionSource } from "../definitions/DefinitionSource"

export class FrameworkComponentDefinitionSource extends DefinitionSource<IComponentDefinition> {
  public loadDefinitions(name: string, dimension: IDimension): Promise<readonly IComponentDefinition[]> {
    switch (name) {
      case "Content":
      case "Children":
        // TODO: Implement and add more here.
        return Promise.resolve([{ tag: name, dimension, type: name }])
      default:
        return Promise.resolve([])
    }
  }
}
