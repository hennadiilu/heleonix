import { DIContainer, DimensionManager, ThemeDefinitionProvider, ThemeDefinitionSource } from "@heleonix/hx-core"
import type { IDimension, IThemeDefinition } from "@heleonix/hx-language"

class ThemeSourceA extends ThemeDefinitionSource {
  public static get diName(): string {
    return "ThemeSourceA"
  }

  public async getDefinitions(_dimension: IDimension): Promise<readonly IThemeDefinition[]> {
    return [{ name: "", dimension: {}, groups: { Palette: { Blue: { t60: "#0f62fe" } } } }]
  }
}

class ThemeSourceB extends ThemeDefinitionSource {
  public static get diName(): string {
    return "ThemeSourceB"
  }

  public async getDefinitions(_dimension: IDimension): Promise<readonly IThemeDefinition[]> {
    return [{ name: "", dimension: {}, groups: { Colors: { Text: { default: "{$Palette.Blue.t60}" } } } }]
  }
}

function providerWith(): ThemeDefinitionProvider {
  const container = new DIContainer()

  container.registerInjectables([DimensionManager, ThemeDefinitionProvider, ThemeSourceA, ThemeSourceB] as never[])
  container.registerSettings("DimensionManager", { dimensions: [] })
  container.registerSettings("ThemeDefinitionProvider", { sources: [ThemeSourceA, ThemeSourceB] })

  return container.inject<ThemeDefinitionProvider>("ThemeDefinitionProvider")
}

describe("ThemeDefinitionProvider", () => {
  it("then aggregates every partial across sources into one token tree", async () => {
    const theme = await providerWith().getTheme()

    expect(theme?.groups).toEqual({
      Palette: { Blue: { t60: "#0f62fe" } },
      Colors: { Text: { default: "{$Palette.Blue.t60}" } },
    })
  })
})
