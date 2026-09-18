import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IState } from "../state/IState"
import type { IBinder } from "../bindings/IBinder"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IActionProvider } from "../actions/IActionProvider"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { StyleManager } from "../styling/StyleManager"
import type { IComponentContext } from "../components/IComponentContext"
import type { Clearables } from "./Clearables"
import { ComponentDefinitionLoader } from "../components/ComponentDefinitionLoader"
import { FrameworkComponentDefinitionSource } from "../components/FrameworkComponentDefinitionSource"
import { ComponentManager } from "../components/ComponentManager"
import { composeComponentConstructors } from "./composeComponentConstructors"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeComponents(
  bootstrap: IApplicationBootstrap,
  deps: {
    runtime: ApplicationRuntime
    dimensions: IDimensionProvider
    state: IState
    binder: IBinder
    configs: IConfigProvider
    dictionaries: IDictionaryProvider
    actions: IActionProvider
    styles: StyleManager | undefined
  },
  clearables: Clearables,
): { components: ComponentManager; componentContext: IComponentContext; isHeadless: boolean } {
  const loader = createDefinitionLoader(bootstrap.componentDefinition, ComponentDefinitionLoader, deps.dimensions, [
    new FrameworkComponentDefinitionSource(),
    ...deps.runtime.componentDefinitionSources,
  ])

  if (loader) {
    clearables.add(loader)
  }

  const components = clearables.add(
    new ComponentManager(
      loader,
      deps.dimensions,
      deps.dictionaries,
      deps.configs,
      composeComponentConstructors(bootstrap, deps.runtime),
      () => componentContext,
      deps.styles,
    ),
  )

  const componentContext: IComponentContext = {
    state: deps.state,
    configs: deps.configs,
    dictionaries: deps.dictionaries,
    binder: deps.binder,
    components,
    scheduler: deps.runtime.scheduler,
    actions: deps.actions,
  }

  return { components, componentContext, isHeadless: loader === undefined }
}
