import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IConfigProvider } from "../configs/IConfigProvider"
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
    services: IServiceProvider
    dimensions: IDimensionController
    clearables: ClearableCollection
  },
): ActionProvider {
  const context: IActionContext = { configs: deps.configs, services: deps.services, dimensions: deps.dimensions }

  return deps.clearables.add(new ActionProvider(hxNameMap(bootstrap.actions ?? []), context))
}
