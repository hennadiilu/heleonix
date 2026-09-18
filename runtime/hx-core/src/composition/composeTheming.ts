import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimension/IDimensionProvider"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { Clearables } from "./Clearables"
import { ThemeDefinitionLoader } from "../theming/ThemeDefinitionLoader"
import { ThemeManager } from "../theming/ThemeManager"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeTheming(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; runtime: ApplicationRuntime },
  clearables: Clearables,
): ThemeManager | undefined {
  // Styles resolve their `{$...}` references through the theme, so a style
  // definition brings theming with it even when no theme is declared.
  const section = bootstrap.themeDefinition ?? (bootstrap.styleDefinition ? { sources: [] } : undefined)

  const loader = createDefinitionLoader(section, ThemeDefinitionLoader, deps.dimensions)

  if (!loader) {
    return undefined
  }

  clearables.add(loader)

  return new ThemeManager(loader, () => deps.runtime.themeDriver)
}
