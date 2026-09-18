import { ThemeManager } from "../../src/theming/ThemeManager"
import type { IThemeDriver } from "@heleonix/hx-core"
import type { IThemeDefinition } from "@heleonix/hx-language"

class FakeThemeDriver implements IThemeDriver {
  public applied?: ReadonlyMap<string, string>
  public artifacts?: IThemeDefinition

  public applyTokens(tokens: ReadonlyMap<string, string>): void {
    this.applied = tokens
  }

  public applyArtifacts(theme: IThemeDefinition): void {
    this.artifacts = theme
  }
}

class FakeThemeProvider {
  public async loadTheme(): Promise<IThemeDefinition> {
    return {
      name: "",
      dimension: {},
      groups: { Palette: { Blue: { t60: "#0f62fe" } }, Spacing: { xs: "4px" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    }
  }
}

describe("ThemeManager", () => {
  it("then flattens the theme and publishes it through the platform's theme driver", async () => {
    const driver = new FakeThemeDriver()
    const manager = new ThemeManager(new FakeThemeProvider() as never, () => driver)

    await manager.apply()

    expect(driver.applied?.get("Palette.Blue.t60")).toBe("#0f62fe")
    expect(driver.applied?.get("Spacing.xs")).toBe("4px")
    expect(driver.artifacts?.keyframes?.pulse).toEqual({ "50%": { transform: "scale(1.1)" } })
  })
})
