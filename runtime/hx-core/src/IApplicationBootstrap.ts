import type { IDimensionDefinition } from "@heleonix/hx-language"
import { Component } from "./components/Component"
import { PlatformAdapter } from "./platform/PlatformAdapter"
import { PlatformRuntime } from "./platform/PlatformRuntime"
import { InjectableConstructor } from "./injection/InjectableConstructor"
import { ComponentDefinitionProvider } from "./components/ComponentDefinitionProvider"
import { DictionaryDefinitionProvider } from "./dictionaries/DictionaryDefinitionProvider"
import { DictionaryDefinitionSource } from "./dictionaries/DictionaryDefinitionSource"
import { ConfigDefinitionProvider } from "./configs/ConfigDefinitionProvider"
import { ComponentDefinitionSource } from "./components/ComponentDefinitionSource"
import { ConfigDefinitionSource } from "./configs/ConfigDefinitionSource"
import { ConfigSelectionStrategy } from "./configs/ConfigSelectionStrategy"
import { DictionarySelectionStrategy } from "./dictionaries/DictionarySelectionStrategy"
import { ComponentSelectionStrategy } from "./components/ComponentSelectionStrategy"

export interface IApplicationBootstrap {
  componentDefinition: {
    provider?: InjectableConstructor<ComponentDefinitionProvider>
    sources: InjectableConstructor<ComponentDefinitionSource>[]
    selectionStrategy?: ComponentSelectionStrategy
  }

  dictionaryDefinition: {
    provider?: InjectableConstructor<DictionaryDefinitionProvider>
    sources: InjectableConstructor<DictionaryDefinitionSource>[]
    selectionStrategy?: DictionarySelectionStrategy
  }

  configDefinition: {
    provider?: InjectableConstructor<ConfigDefinitionProvider>
    sources: InjectableConstructor<ConfigDefinitionSource>[]
    selectionStrategy?: ConfigSelectionStrategy
  }

  dimensions?: IDimensionDefinition[]

  platform: {
    runtime: InjectableConstructor<PlatformRuntime>
    adapter: InjectableConstructor<PlatformAdapter>
  }

  components?: InjectableConstructor<Component>[]
}
