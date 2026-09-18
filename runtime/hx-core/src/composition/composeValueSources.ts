import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IState } from "../state/IState"
import type { IValueSource } from "../bindings/IValueSource"
import type { Clearables } from "./Clearables"
import { StateValueSource } from "../state/StateValueSource"
import { LiteralValueSource } from "../bindings/LiteralValueSource"
import { ConfigValueSource } from "../configs/ConfigValueSource"
import { ConfigDefinitionLoader } from "../configs/ConfigDefinitionLoader"
import { DictionaryValueSource } from "../dictionaries/DictionaryValueSource"
import { DictionaryDefinitionLoader } from "../dictionaries/DictionaryDefinitionLoader"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeValueSources(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; state: IState },
  clearables: Clearables,
): IValueSource[] {
  const sources: IValueSource[] = [new StateValueSource(deps.state), new LiteralValueSource()]

  // An absent definition section registers no source at all, so a binding of
  // that type resolves to `undefined`.
  const configs = createDefinitionLoader(bootstrap.configDefinition, ConfigDefinitionLoader, deps.dimensions)

  if (configs) {
    sources.push(new ConfigValueSource(clearables.add(configs)))
  }

  const dictionaries = createDefinitionLoader(
    bootstrap.dictionaryDefinition,
    DictionaryDefinitionLoader,
    deps.dimensions,
  )

  if (dictionaries) {
    sources.push(new DictionaryValueSource(clearables.add(dictionaries)))
  }

  return sources
}
