import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IState } from "../state/IState"
import type { IBindingValueSource } from "../bindings/IBindingValueSource"
import type { ClearableCollection } from "./ClearableCollection"
import { StateBindingValueSource } from "../state/StateBindingValueSource"
import { LiteralBindingValueSource } from "../bindings/LiteralBindingValueSource"
import { ConfigBindingValueSource } from "../configs/ConfigBindingValueSource"
import { ConfigDefinitionLoader } from "../configs/ConfigDefinitionLoader"
import { DictionaryBindingValueSource } from "../dictionaries/DictionaryBindingValueSource"
import { DictionaryDefinitionLoader } from "../dictionaries/DictionaryDefinitionLoader"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeBindingValueSources(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; state: IState; clearables: ClearableCollection },
): IBindingValueSource[] {
  const sources: IBindingValueSource[] = [new StateBindingValueSource(deps.state), new LiteralBindingValueSource()]

  const configs = createDefinitionLoader(bootstrap.configDefinition, ConfigDefinitionLoader, deps.dimensions)

  if (configs) {
    sources.push(new ConfigBindingValueSource(deps.clearables.add(configs)))
  }

  const dictionaries = createDefinitionLoader(
    bootstrap.dictionaryDefinition,
    DictionaryDefinitionLoader,
    deps.dimensions,
  )

  if (dictionaries) {
    sources.push(new DictionaryBindingValueSource(deps.clearables.add(dictionaries)))
  }

  return sources
}
