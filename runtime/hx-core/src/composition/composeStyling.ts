import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { IState } from "../state/IState"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { ThemeManager } from "../theming/ThemeManager"
import type { Clearables } from "./Clearables"
import { StyleDefinitionLoader } from "../styling/StyleDefinitionLoader"
import { StyleManager } from "../styling/StyleManager"
import { composeQualifiers } from "./composeQualifiers"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeStyling(
  bootstrap: IApplicationBootstrap,
  deps: {
    dimensions: IDimensionProvider
    state: IState
    runtime: ApplicationRuntime
    themes: ThemeManager | undefined
  },
  clearables: Clearables,
): StyleManager | undefined {
  const loader = createDefinitionLoader(bootstrap.styleDefinition, StyleDefinitionLoader, deps.dimensions)

  // Styling stands on theming: with no theme to resolve against, a style
  // definition builds nothing.
  if (!loader || !deps.themes) {
    return undefined
  }

  clearables.add(loader)

  return clearables.add(
    new StyleManager(
      () => deps.runtime.styleDriver,
      loader,
      deps.themes,
      deps.state,
      composeQualifiers(bootstrap, { state: deps.state }),
    ),
  )
}
