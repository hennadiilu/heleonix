import { EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"
import { AnalyzerHost, ANALYZER_EXTS } from "../src/analysis/AnalyzerHost"

describe("AnalyzerHost styling bridge", () => {
  it("then feeds style and theme files to the analyzer", () => {
    expect(ANALYZER_EXTS.has(EXT_STYLE)).toBeTrue()
    expect(ANALYZER_EXTS.has(EXT_THEME)).toBeTrue()
  })

  it("then exposes theme tokens and qualifiers from dependency meta", () => {
    const host = new AnalyzerHost()

    host.addMeta({
      schemaVersion: 1,
      themeTokens: { "Brand.accent": "#7c3aed" },
      qualifiers: [{ name: "If", args: [] }],
    })

    const snapshot = host.snapshot()

    expect(snapshot.themeTokens.get("Brand.accent")).toBe("#7c3aed")
    expect(snapshot.qualifiers.map((q) => q.name)).toEqual(["If"])
  })
})
