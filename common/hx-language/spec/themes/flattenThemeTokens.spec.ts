import { flattenThemeTokens } from "@heleonix/hx-language"

describe("flattenThemeTokens", () => {
  describe("given a nested token tree", () => {
    it("then flattens leaves to dot-paths keeping values verbatim", () => {
      const tokens = flattenThemeTokens({
        Palette: { Blue: { t60: "#0f62fe" }, Neutral: { t0: "#ffffff" } },
        Colors: { Bg: { canvas: "light-dark({$Palette.Neutral.t0}, {$Palette.Blue.t60})" } },
        Spacing: { xs: "4px" },
      })

      expect(tokens).toEqual({
        "Palette.Blue.t60": "#0f62fe",
        "Palette.Neutral.t0": "#ffffff",
        "Colors.Bg.canvas": "light-dark({$Palette.Neutral.t0}, {$Palette.Blue.t60})",
        "Spacing.xs": "4px",
      })
    })
  })

  describe("given an empty tree", () => {
    it("then returns no tokens", () => {
      expect(flattenThemeTokens({})).toEqual({})
    })
  })
})
