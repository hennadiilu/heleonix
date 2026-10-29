import { flattenThemeTokens } from "@heleonix/hx-language"
import type { IThemeDefinition } from "@heleonix/hx-language"
import type { IThemeDriver } from "../platform/IThemeDriver"
import { themeVariableName } from "./themeVariableName"
import { ThemeDefinitionLoader } from "./ThemeDefinitionLoader"

export class ThemeManager {
  public constructor(
    private readonly loader: ThemeDefinitionLoader,
    // A thunk for the same reason the style manager takes one: a runtime may
    // rebuild its drivers on every start.
    private readonly driver: () => IThemeDriver,
  ) {}

  public getTheme(): Promise<IThemeDefinition | undefined> {
    return this.loader.loadTheme()
  }

  public async apply(): Promise<void> {
    const theme = await this.loader.loadTheme()

    if (theme) {
      const tokens = Object.entries(flattenThemeTokens(theme.groups))

      this.driver().applyTokens(new Map(tokens.map(([path, value]) => [themeVariableName(path), value])))
      this.driver().applyArtifacts(theme)
    }
  }
}
