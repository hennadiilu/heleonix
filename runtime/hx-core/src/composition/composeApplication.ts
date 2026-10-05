import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IApplicationGraph } from "./IApplicationGraph"
import { StateManager } from "../state/StateManager"
import { DimensionManager } from "../dimensions/DimensionManager"
import { ClearableCollection } from "./ClearableCollection"
import { composeBindings } from "./composeBindings"
import { composeServices } from "./composeServices"
import { composeActions } from "./composeActions"
import { composeTheming } from "./composeTheming"
import { composeStyling } from "./composeStyling"
import { composeComponents } from "./composeComponents"

export function composeApplication(bootstrap: IApplicationBootstrap): IApplicationGraph {
  const clearables = new ClearableCollection()

  const state = clearables.add(new StateManager())

  const dimensions = new DimensionManager(bootstrap.dimensions ?? [])

  const runtime = new bootstrap.runtime()

  const { binder, configs, dictionaries, evaluator } = composeBindings(bootstrap, { dimensions, state, clearables })

  const services = composeServices(bootstrap, { clearables })

  const actions = composeActions(bootstrap, { configs, services, dimensions, clearables })

  const themes = composeTheming(bootstrap, { dimensions, runtime, clearables })

  const styles = composeStyling(bootstrap, { dimensions, state, evaluator, runtime, themes, clearables })

  const { components, componentContext, isHeadless } = composeComponents(bootstrap, {
    runtime,
    dimensions,
    state,
    binder,
    configs,
    dictionaries,
    actions,
    styles,
    clearables,
  })

  return {
    runtime,
    scheduler: runtime.scheduler,
    dimensions,
    state,
    configs,
    dictionaries,
    actions,
    services,
    components,
    componentContext,
    themes,
    styles,
    isHeadless,
    clearables: clearables.getOrdered(),
  }
}
