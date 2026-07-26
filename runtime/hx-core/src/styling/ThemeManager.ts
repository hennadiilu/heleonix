import { flattenThemeTokens } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { DimensionManager } from "../dimension/DimensionManager"
import { PlatformAdapter } from "../platform/PlatformAdapter"
import { ThemeDefinitionProvider } from "./ThemeDefinitionProvider"
import { IDIContainer } from "../injection/IDIContainer"

/**
 * Publishes the application theme: flattens the merged token tree to the
 * `{$...}`-addressable dot-path map and hands it to the platform
 * ({@link PlatformAdapter.applyThemeTokens} - web sets `--hx-*` at the app root,
 * SSR serializes into HTML), then publishes the theme's `@`-artifacts
 * ({@link PlatformAdapter.applyThemeArtifacts}). Re-applies on a dimension change
 * so a brand overlay swaps only the overridden variables. Platform-agnostic.
 */
export class ThemeManager extends FrameworkElement<ThemeDefinitionProvider | PlatformAdapter | DimensionManager> {
  private readonly provider = this.inject(ThemeDefinitionProvider)

  private readonly platformAdapter = this.inject(PlatformAdapter)

  private readonly dimensionManager = this.inject(DimensionManager)

  public constructor(diContainer: IDIContainer) {
    super(diContainer)

    this.dimensionManager.dimensionChanged.on(() => void this.apply())
  }

  public static get diName(): string {
    return "ThemeManager"
  }

  public async apply(): Promise<void> {
    const theme = await this.provider.getTheme()

    if (theme) {
      this.platformAdapter.applyThemeTokens(new Map(Object.entries(flattenThemeTokens(theme.groups))))
      this.platformAdapter.applyThemeArtifacts(theme)
    }
  }
}
