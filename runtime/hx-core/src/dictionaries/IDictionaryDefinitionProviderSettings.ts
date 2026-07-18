import { InjectableConstructor } from "../injection/InjectableConstructor"
import { DictionaryDefinitionSource } from "./DictionaryDefinitionSource"
import { DictionarySelectionStrategy } from "./DictionarySelectionStrategy"

export interface IDictionaryDefinitionProviderSettings {
  sources: readonly InjectableConstructor<DictionaryDefinitionSource>[]
  selectionStrategy?: DictionarySelectionStrategy
}
