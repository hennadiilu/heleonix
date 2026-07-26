import { InjectableConstructor } from "../injection/InjectableConstructor"
import { ThemeDefinitionSource } from "./ThemeDefinitionSource"

export interface IThemeDefinitionProviderSettings {
  sources: readonly InjectableConstructor<ThemeDefinitionSource>[]
}
