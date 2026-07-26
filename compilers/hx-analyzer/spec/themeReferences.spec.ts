import { Analyzer } from "@heleonix/hx-analyzer"
import { EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"

function analyzerWith(
  ...files: { path: string; ext: string; name: string; dimension: {}; source: string }[]
): Analyzer {
  const analyzer = new Analyzer()

  for (const file of files) {
    analyzer.setFile(file)
  }

  return analyzer
}

const primitives = {
  path: "/src/Primitives.hxt",
  ext: EXT_THEME,
  name: "Primitives",
  dimension: {},
  source: `Palette { Neutral { t90: #18181b; } Blue { t60: #0f62fe; } }`,
}

const semantic = {
  path: "/src/Semantic.hxt",
  ext: EXT_THEME,
  name: "Semantic",
  dimension: {},
  source: `Colors { Text { default: {$Palette.Neutral.t90}; } }`,
}

describe("Analyzer themeTokenLocations()", () => {
  it("then locates a token's leaf declaration, narrowing same-named leaves by group", async () => {
    const analyzer = analyzerWith(primitives)
    await analyzer.analyze()

    const location = analyzer.themeTokenLocations().get("Palette.Blue.t60")

    expect(location?.file).toBe("/src/Primitives.hxt")
    expect(location?.line).toBe(0)
    expect(primitives.source.slice(location!.character, location!.character + location!.length)).toBe("t60")
  })

  it("then computes the line for a multi-line theme partial", async () => {
    const spacing = {
      path: "/src/Spacing.hxt",
      ext: EXT_THEME,
      name: "Spacing",
      dimension: {},
      source: "Spacing {\n  xs: 4px;\n  md: 16px;\n}",
    }
    const analyzer = analyzerWith(spacing)
    await analyzer.analyze()

    const location = analyzer.themeTokenLocations().get("Spacing.md")

    expect(location).toEqual({ file: "/src/Spacing.hxt", line: 2, character: 2, length: 2 })
  })

  it("then omits tokens with no workspace source", async () => {
    const analyzer = analyzerWith(primitives)
    await analyzer.analyze()

    expect(analyzer.themeTokenLocations().get("Palette.Nope.t10")).toBeUndefined()
  })
})

describe("Analyzer theme references (0004/0005)", () => {
  describe("given a style referencing a defined token", () => {
    const style = {
      path: "/src/Button.hxs",
      ext: EXT_STYLE,
      name: "Button",
      dimension: {},
      source: `color: {$Colors.Text.default};`,
    }

    it("then reports no diagnostics and resolves the alias chain", async () => {
      expect(await analyzerWith(primitives, semantic, style).analyze()).toEqual([])
    })
  })

  describe("given a style referencing an unknown token", () => {
    const style = {
      path: "/src/Button.hxs",
      ext: EXT_STYLE,
      name: "Button",
      dimension: {},
      source: `color: {$Colors.Text.nope};`,
    }

    it("then reports the unresolved theme reference", async () => {
      const result = await analyzerWith(primitives, semantic, style).analyze()

      expect(result).toEqual([
        jasmine.objectContaining({ code: "HX_ANALYZER_0004", file: "/src/Button.hxs", subject: "{$Colors.Text.nope}" }),
      ])
    })
  })

  describe("given a theme alias to an unknown token", () => {
    const broken = { ...semantic, source: `Colors { Text { default: {$Palette.Neutral.missing}; } }` }

    it("then reports the unresolved theme reference on the theme file", async () => {
      const result = await analyzerWith(primitives, broken).analyze()

      expect(result).toEqual([
        jasmine.objectContaining({ code: "HX_ANALYZER_0004", subject: "{$Palette.Neutral.missing}" }),
      ])
    })
  })

  describe("given an alias cycle", () => {
    const cyclic = {
      path: "/src/Cycle.hxt",
      ext: EXT_THEME,
      name: "Cycle",
      dimension: {},
      source: `A { a: {$A.b}; b: {$A.a}; }`,
    }

    it("then reports both tokens on the cycle", async () => {
      const result = await analyzerWith(cyclic).analyze()
      const cycles = result.filter((d) => d.code === "HX_ANALYZER_0005")

      expect(cycles.map((d) => d.subject).sort()).toEqual(["A.a", "A.b"])
    })
  })

  describe("given a token delivered by a dependency's meta", () => {
    const style = {
      path: "/src/Button.hxs",
      ext: EXT_STYLE,
      name: "Button",
      dimension: {},
      source: `background-color: {$Brand.accent};`,
    }

    it("then resolves against the merged token space", async () => {
      const analyzer = analyzerWith(style)
      analyzer.addMeta({ schemaVersion: 1, themeTokens: { "Brand.accent": "#7c3aed" } })

      expect(await analyzer.analyze()).toEqual([])
    })
  })

  describe("given the theme token accessor", () => {
    it("then merges workspace partials and dependency meta", async () => {
      const analyzer = analyzerWith(primitives, semantic)
      analyzer.addMeta({ schemaVersion: 1, themeTokens: { "Brand.accent": "#7c3aed" } })

      await analyzer.analyze()

      const tokens = analyzer.themeTokens()

      expect(tokens.get("Palette.Blue.t60")).toBe("#0f62fe")
      expect(tokens.get("Colors.Text.default")).toBe("{$Palette.Neutral.t90}")
      expect(tokens.get("Brand.accent")).toBe("#7c3aed")
    })
  })
})
