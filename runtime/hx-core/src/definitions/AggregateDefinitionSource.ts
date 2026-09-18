import type { IDimension } from "@heleonix/hx-language"

export abstract class AggregateDefinitionSource<TDefinition> {
  public abstract loadDefinitions(dimension: IDimension): Promise<readonly TDefinition[]>
}
