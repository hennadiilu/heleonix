import type { IApplicationBootstrap } from "../IApplicationBootstrap"
import type { IDimensionProvider } from "../dimensions/IDimensionProvider"
import type { ApplicationRuntime } from "../platform/ApplicationRuntime"
import type { ClearableCollection } from "./ClearableCollection"
import { ThemeDefinitionLoader } from "../theming/ThemeDefinitionLoader"
import { ThemeManager } from "../theming/ThemeManager"
import { createDefinitionLoader } from "./createDefinitionLoader"

export function composeTheming(
  bootstrap: IApplicationBootstrap,
  deps: { dimensions: IDimensionProvider; runtime: ApplicationRuntime; clearables: ClearableCollection },
): ThemeManager | undefined {
  const section = bootstrap.themeDefinition ?? (bootstrap.styleDefinition ? { sources: [] } : undefined)

  const loader = createDefinitionLoader(section, ThemeDefinitionLoader, deps.dimensions)

  if (!loader) {
    return undefined
  }

  deps.clearables.add(loader)

  return new ThemeManager(loader, () => deps.runtime.themeDriver)
}
