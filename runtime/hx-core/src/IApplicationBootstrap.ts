import type {
  IComponentDefinition,
  IConfigDefinition,
  IDictionaryDefinition,
  IDimensionDefinition,
  IStyleDefinition,
  IThemeDefinition,
} from "@heleonix/hx-language"
import { ComponentConstructor } from "./components/ComponentConstructor"
import type { ApplicationRuntimeConstructor } from "./platform/ApplicationRuntimeConstructor"
import { ComponentDefinitionLoader } from "./components/ComponentDefinitionLoader"
import { DictionaryDefinitionLoader } from "./dictionaries/DictionaryDefinitionLoader"
import { ConfigDefinitionLoader } from "./configs/ConfigDefinitionLoader"
import { AggregateDefinitionSource } from "./definitions/AggregateDefinitionSource"
import { DefinitionSource } from "./definitions/DefinitionSource"
import type { IDefinitionSection } from "./IDefinitionSection"
import { StyleDefinitionLoader } from "./styling/StyleDefinitionLoader"
import { ThemeDefinitionLoader } from "./theming/ThemeDefinitionLoader"
import { ConverterConstructor } from "./converters/ConverterConstructor"
import { ActionConstructor } from "./actions/ActionConstructor"
import { ServiceConstructor } from "./services/ServiceConstructor"
import { StyleQualifierConstructor } from "./styling/qualifiers/StyleQualifierConstructor"

export interface IApplicationBootstrap {
  runtime: ApplicationRuntimeConstructor

  componentDefinition?: IDefinitionSection<DefinitionSource<IComponentDefinition>, ComponentDefinitionLoader>

  dictionaryDefinition?: IDefinitionSection<DefinitionSource<IDictionaryDefinition>, DictionaryDefinitionLoader>

  configDefinition?: IDefinitionSection<DefinitionSource<IConfigDefinition>, ConfigDefinitionLoader>

  styleDefinition?: IDefinitionSection<DefinitionSource<IStyleDefinition>, StyleDefinitionLoader>

  themeDefinition?: Omit<
    IDefinitionSection<AggregateDefinitionSource<IThemeDefinition>, ThemeDefinitionLoader>,
    "selectionStrategy"
  >

  dimensions?: IDimensionDefinition[]

  components?: ComponentConstructor[]

  converters?: ConverterConstructor[]

  actions?: ActionConstructor[]

  qualifiers?: StyleQualifierConstructor[]

  services?: ServiceConstructor[]
}
