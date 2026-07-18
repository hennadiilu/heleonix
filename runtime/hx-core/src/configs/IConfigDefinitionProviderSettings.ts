import { InjectableConstructor } from "../injection/InjectableConstructor"
import { ConfigDefinitionSource } from "./ConfigDefinitionSource"
import { ConfigSelectionStrategy } from "./ConfigSelectionStrategy"

export interface IConfigDefinitionProviderSettings {
  sources: readonly InjectableConstructor<ConfigDefinitionSource>[]
  selectionStrategy?: ConfigSelectionStrategy
}
