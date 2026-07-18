import type { IComponentDefinition } from "@heleonix/hx-language"
import type { IDimension } from "@heleonix/hx-language"
import { ComponentDefinitionSource } from "./ComponentDefinitionSource"

export class FrameworkComponentDefinitionSource extends ComponentDefinitionSource {
  public static get diName(): string {
    return "FrameworkComponentDefinitionSource"
  }

  public getDefinitions(name: string, dimension: IDimension): Promise<readonly IComponentDefinition[]> {
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
