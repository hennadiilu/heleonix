import { InjectableConstructor } from "../injection/InjectableConstructor"
import { StyleDefinitionSource } from "./StyleDefinitionSource"
import { StyleSelectionStrategy } from "./StyleSelectionStrategy"

export interface IStyleDefinitionProviderSettings {
  sources: readonly InjectableConstructor<StyleDefinitionSource>[]
  selectionStrategy?: StyleSelectionStrategy
}
