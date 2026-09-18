import { AggregateDefinitionSource, ThemeDefinitionLoader } from "@heleonix/hx-core"
import { DimensionManager } from "../../src/dimension/DimensionManager"
import type { IDimension, IThemeDefinition } from "@heleonix/hx-language"

class ThemeSourceA extends AggregateDefinitionSource<IThemeDefinition> {
  public async loadDefinitions(_dimension: IDimension): Promise<readonly IThemeDefinition[]> {
    return [{ name: "", dimension: {}, groups: { Palette: { Blue: { t60: "#0f62fe" } } } }]
  }
}

class ThemeSourceB extends AggregateDefinitionSource<IThemeDefinition> {
  public async loadDefinitions(_dimension: IDimension): Promise<readonly IThemeDefinition[]> {
    return [{ name: "", dimension: {}, groups: { Colors: { Text: { default: "{$Palette.Blue.t60}" } } } }]
  }
}

function loaderWith(): ThemeDefinitionLoader {
  return new ThemeDefinitionLoader(new DimensionManager([]), [new ThemeSourceA(), new ThemeSourceB()])
}

describe("ThemeDefinitionLoader", () => {
  it("then aggregates every partial across sources into one token tree", async () => {
    const theme = await loaderWith().loadTheme()

    expect(theme?.groups).toEqual({
      Palette: { Blue: { t60: "#0f62fe" } },
      Colors: { Text: { default: "{$Palette.Blue.t60}" } },
    })
  })
})
