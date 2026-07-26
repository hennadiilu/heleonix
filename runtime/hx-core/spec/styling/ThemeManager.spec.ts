import { DIContainer, DimensionManager, FrameworkElement, PlatformAdapter, ThemeManager } from "@heleonix/hx-core"
import type { Component, StyleEnginePlatform } from "@heleonix/hx-core"
import type { IThemeDefinition } from "@heleonix/hx-language"

class FakePlatformAdapter extends PlatformAdapter {
  public applied?: ReadonlyMap<string, string>
  public artifacts?: IThemeDefinition

  public static override get diName(): string {
    return "PlatformAdapter"
  }

  public get styleEnginePlatform(): StyleEnginePlatform<Component> {
    return { compose: () => ({}) as never, release: () => {}, effectFor: () => ({}) as never }
  }

  public scheduleTask(): void {}

  public getRootHost(): null {
    return null
  }

  public applyThemeTokens(tokens: ReadonlyMap<string, string>): void {
    this.applied = tokens
  }

  public applyThemeArtifacts(theme: IThemeDefinition): void {
    this.artifacts = theme
  }
}

class FakeThemeProvider extends FrameworkElement {
  public static get diName(): string {
    return "ThemeDefinitionProvider"
  }

  public async getTheme(): Promise<IThemeDefinition> {
    return {
      name: "",
      dimension: {},
      groups: { Palette: { Blue: { t60: "#0f62fe" } }, Spacing: { xs: "4px" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    }
  }
}

describe("ThemeManager", () => {
  it("then flattens the theme and publishes it through the platform", async () => {
    const container = new DIContainer()
    container.registerInjectables([ThemeManager, DimensionManager, FakePlatformAdapter, FakeThemeProvider] as never[])
    container.registerSettings("DimensionManager", { dimensions: [] })

    const manager = container.inject<ThemeManager>("ThemeManager")
    const adapter = container.inject<FakePlatformAdapter>("PlatformAdapter")

    await manager.apply()

    expect(adapter.applied?.get("Palette.Blue.t60")).toBe("#0f62fe")
    expect(adapter.applied?.get("Spacing.xs")).toBe("4px")
    expect(adapter.artifacts?.keyframes?.pulse).toEqual({ "50%": { transform: "scale(1.1)" } })
  })
})
