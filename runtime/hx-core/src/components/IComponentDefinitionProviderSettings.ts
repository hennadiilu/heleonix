import { InjectableConstructor } from "../injection/InjectableConstructor"
import { ComponentDefinitionSource } from "./ComponentDefinitionSource"
import { ComponentSelectionStrategy } from "./ComponentSelectionStrategy"

export interface IComponentDefinitionProviderSettings {
  sources: readonly InjectableConstructor<ComponentDefinitionSource>[]
  selectionStrategy?: ComponentSelectionStrategy
}
