import { DefinitionSelectionStrategy, DefinitionSource, ThemeDefinitionLoader } from "@heleonix/hx-core"
import { DimensionManager } from "../../src/dimensions/DimensionManager"
import { THEME_DEFINITION_NAME } from "@heleonix/hx-language"
import type { IThemeDefinition } from "@heleonix/hx-language"

class ThemeSource extends DefinitionSource<IThemeDefinition> {
  public loads = 0

  public constructor(private readonly partials: readonly IThemeDefinition[]) {
    super()
  }

  public loadDefinitions(name: string): Promise<readonly IThemeDefinition[]> {
    this.loads++

    return Promise.resolve(name === THEME_DEFINITION_NAME ? this.partials : [])
  }
}

const palette = (): ThemeSource =>
  new ThemeSource([{ name: "Palette", dimension: {}, groups: { Palette: { Blue: { t60: "#0f62fe" } } } }])

const colors = (): ThemeSource =>
  new ThemeSource([{ name: "Colors", dimension: {}, groups: { Colors: { Text: { default: "{$Palette.Blue.t60}" } } } }])

function loaderWith(
  sources: readonly ThemeSource[],
  selectionStrategy?: DefinitionSelectionStrategy,
): ThemeDefinitionLoader {
  const dimensions = new DimensionManager([{ name: "customer", values: ["a", "b"] }])

  dimensions.update({ customer: "a" })

  return new ThemeDefinitionLoader(dimensions, sources, selectionStrategy)
}

describe("ThemeDefinitionLoader", () => {
  it("then aggregates every partial across sources into one token tree", async () => {
    const theme = await loaderWith([palette(), colors()]).loadTheme()

    expect(theme?.groups).toEqual({
      Palette: { Blue: { t60: "#0f62fe" } },
      Colors: { Text: { default: "{$Palette.Blue.t60}" } },
    })
  })

  it("then lets the later-registered source win per leaf", async () => {
    const app = new ThemeSource([{ name: "Brand", dimension: {}, groups: { Palette: { Blue: { t60: "#001d6c" } } } }])

    const theme = await loaderWith([palette(), app]).loadTheme()

    expect(theme?.groups).toEqual({ Palette: { Blue: { t60: "#001d6c" } } })
  })

  it("then honours the selection strategy, so the last source's theme can replace the others", async () => {
    const theme = await loaderWith([palette(), colors()], DefinitionSelectionStrategy.Last).loadTheme()

    expect(theme?.groups).toEqual({ Colors: { Text: { default: "{$Palette.Blue.t60}" } } })
  })

  it("then stops at a source whose matching partial overrides, so the sources below it are never loaded", async () => {
    const base = palette()
    const app = new ThemeSource([
      { name: "Brand", dimension: { customer: "a" }, usage: "override", groups: { Spacing: { xs: "2px" } } },
    ])

    const theme = await loaderWith([base, app]).loadTheme()

    expect(theme?.groups).toEqual({ Spacing: { xs: "2px" } })
    expect(base.loads).toBe(0)
  })

  it("then keeps loading below an overriding partial that does not match the current dimension", async () => {
    const base = palette()
    const app = new ThemeSource([
      { name: "Brand", dimension: { customer: "b" }, usage: "override", groups: { Spacing: { xs: "2px" } } },
    ])

    const theme = await loaderWith([base, app]).loadTheme()

    expect(theme?.groups).toEqual({ Palette: { Blue: { t60: "#0f62fe" } } })
    expect(base.loads).toBe(1)
  })
})
