import type { IDimension } from "@heleonix/hx-language"

export abstract class DefinitionSource<TDefinition> {
  public abstract loadDefinitions(name: string, dimension: IDimension): Promise<readonly TDefinition[]>
}
