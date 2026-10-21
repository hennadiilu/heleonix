import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IServiceProvider } from "../services/IServiceProvider"
import type { IDimensionController } from "../dimensions/IDimensionController"
import type { IActionContext } from "../actions/IActionContext"
import type { ClearableCollection } from "./ClearableCollection"
import { ActionProvider } from "../actions/ActionProvider"
import { hxNameMap } from "./hxNameMap"

export function composeActions(
  bootstrap: IApplicationBootstrap,
  deps: {
    configs: IConfigProvider
    dictionaries: IDictionaryProvider
    services: IServiceProvider
    dimensions: IDimensionController
    clearables: ClearableCollection
  },
): ActionProvider {
  const context: IActionContext = {
    configs: deps.configs,
    dictionaries: deps.dictionaries,
    services: deps.services,
    dimensions: deps.dimensions,
  }

  return deps.clearables.add(new ActionProvider(hxNameMap(bootstrap.actions ?? []), context))
}
