import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IState } from "../state/IState"
import type { IValueSource } from "../bindings/IValueSource"
import type { ClearableCollection } from "./ClearableCollection"
import { StateValueSource } from "../state/StateValueSource"
import { LiteralValueSource } from "../bindings/LiteralValueSource"
import { ConfigValueSource } from "../configs/ConfigValueSource"
import { ConfigDefinitionLoader } from "../configs/ConfigDefinitionLoader"
import { DictionaryValueSource } from "../dictionaries/DictionaryValueSource"
import { DictionaryDefinitionLoader } from "../dictionaries/DictionaryDefinitionLoader"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeValueSources(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; state: IState; clearables: ClearableCollection },
): IValueSource[] {
  const sources: IValueSource[] = [new StateValueSource(deps.state), new LiteralValueSource()]

  const configs = createDefinitionLoader(bootstrap.configDefinition, ConfigDefinitionLoader, deps.dimensions)

  if (configs) {
    sources.push(new ConfigValueSource(deps.clearables.add(configs)))
  }

  const dictionaries = createDefinitionLoader(
    bootstrap.dictionaryDefinition,
    DictionaryDefinitionLoader,
    deps.dimensions,
  )

  if (dictionaries) {
    sources.push(new DictionaryValueSource(deps.clearables.add(dictionaries)))
  }

  return sources
}
