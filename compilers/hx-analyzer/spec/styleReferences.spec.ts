import { Analyzer } from "@heleonix/hx-analyzer"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"

const dictionary = {
  path: "/src/Buttons.hxd",
  ext: EXT_DICTIONARY,
  name: "Buttons",
  dimension: {},
  source: `{ "save": "Save" }`,
}
const config = { path: "/src/App.hxc", ext: EXT_CONFIG, name: "App", dimension: {}, source: `{ "title": "Hx" }` }
const breakpoints = {
  path: "/src/Breakpoints.hxt",
  ext: EXT_THEME,
  name: "Breakpoints",
  dimension: {},
  source: `Breakpoints { mobile: 480px; }`,
}

function analyzerWith(
  ...files: { path: string; ext: string; name: string; dimension: {}; source: string }[]
): Analyzer {
  const analyzer = new Analyzer()

  for (const file of files) {
    analyzer.setFile(file)
  }

  return analyzer
}

function style(source: string): { path: string; ext: string; name: string; dimension: {}; source: string } {
  return { path: "/src/Card.hxs", ext: EXT_STYLE, name: "Card", dimension: {}, source }
}

describe("Analyzer style dictionary/config references (0002/0003)", () => {
  describe("given a resolvable dictionary reference in a value", () => {
    it("then reports nothing", async () => {
      expect(await analyzerWith(dictionary, style(`::before { content: {@Buttons.save}; }`)).analyze()).toEqual([])
    })
  })

  describe("given an unknown dictionary reference", () => {
    it("then reports the unresolved dictionary entry", async () => {
      const result = await analyzerWith(dictionary, style(`::before { content: {@Buttons.missing}; }`)).analyze()

      expect(result).toEqual([jasmine.objectContaining({ code: "HX_ANALYZER_0002", file: "/src/Card.hxs" })])
    })
  })

  describe("given a config reference", () => {
    it("then resolves a known entry and flags an unknown one", async () => {
      expect(await analyzerWith(config, style(`::before { content: {#App.title}; }`)).analyze()).toEqual([])

      const bad = await analyzerWith(config, style(`::before { content: {#App.missing}; }`)).analyze()
      expect(bad).toEqual([jasmine.objectContaining({ code: "HX_ANALYZER_0003" })])
    })
  })

  describe("given a theme reference inside a media-query argument", () => {
    it("then resolves it (qualifier args are scanned, not just declaration values)", async () => {
      const ok = await analyzerWith(
        breakpoints,
        style(`@media (max-width: {$Breakpoints.mobile}) { color: red; }`),
      ).analyze()
      expect(ok).toEqual([])

      const bad = await analyzerWith(
        breakpoints,
        style(`@media (max-width: {$Breakpoints.desktop}) { color: red; }`),
      ).analyze()
      expect(bad).toEqual([jasmine.objectContaining({ code: "HX_ANALYZER_0004", subject: "{$Breakpoints.desktop}" })])
    })
  })
})
