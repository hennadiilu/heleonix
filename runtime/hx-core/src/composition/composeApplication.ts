import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IApplicationGraph } from "./IApplicationGraph"
import { StateManager } from "../state/StateManager"
import { DimensionManager } from "../dimension/DimensionManager"
import { Clearables } from "./Clearables"
import { composeBindings } from "./composeBindings"
import { composeServices } from "./composeServices"
import { composeActions } from "./composeActions"
import { composeTheming } from "./composeTheming"
import { composeStyling } from "./composeStyling"
import { composeComponents } from "./composeComponents"

export function composeApplication(bootstrap: IApplicationBootstrap): IApplicationGraph {
  const clearables = new Clearables()

  const state = clearables.add(new StateManager())

  const dimensions = new DimensionManager(bootstrap.dimensions ?? [])

  const runtime = new bootstrap.runtime()

  const { binder, configs, dictionaries } = composeBindings(bootstrap, { dimensions, state }, clearables)

  const services = composeServices(bootstrap, clearables)

  const actions = composeActions(bootstrap, { configs, services, dimensions }, clearables)

  const themes = composeTheming(bootstrap, { dimensions, runtime }, clearables)

  const styles = composeStyling(bootstrap, { dimensions, state, runtime, themes }, clearables)

  const { components, componentContext, isHeadless } = composeComponents(
    bootstrap,
    { runtime, dimensions, state, binder, configs, dictionaries, actions, styles },
    clearables,
  )

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
    clearables: clearables.teardownOrder,
  }
}
