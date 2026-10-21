import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { IState } from "../state/IState"
import type { BindingEvaluator } from "../bindings/BindingEvaluator"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { IThemeManager } from "../theming/IThemeManager"
import type { ClearableCollection } from "./ClearableCollection"
import { StyleDefinitionLoader } from "../styling/StyleDefinitionLoader"
import { StyleManager } from "../styling/StyleManager"
import { composeQualifiers } from "./composeQualifiers"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeStyling(
  bootstrap: IApplicationBootstrap,
  deps: {
    dimensions: IDimensionProvider
    state: IState
    evaluator: BindingEvaluator
    runtime: ApplicationRuntime
    themes: IThemeManager | undefined
    clearables: ClearableCollection
  },
): StyleManager | undefined {
  const loader = createDefinitionLoader(bootstrap.styleDefinition, StyleDefinitionLoader, deps.dimensions)

  if (!loader || !deps.themes) {
    return undefined
  }

  deps.clearables.add(loader)

  return deps.clearables.add(
    new StyleManager(
      () => deps.runtime.styleDriver,
      loader,
      deps.themes,
      deps.state,
      deps.evaluator,
      composeQualifiers(bootstrap),
    ),
  )
}
