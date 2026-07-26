import { ThemeCompiler, HeleonixThemeCompilerError } from "@heleonix/hx-compiler-themes"
import { Merger } from "@heleonix/hx-utils"

const compiler = new ThemeCompiler()

describe("ThemeCompiler", () => {
  describe("given a nested token tree", () => {
    const source = `Palette {
  Neutral { t0: #ffffff; t100: #09090b; }
  Blue { t60: #0f62fe; }
}
Spacing { xs: 4px; sm: 8px; md: 12px; }`

    it("then builds groups nesting groups and leaf tokens", async () => {
      const { groups } = await compiler.compile(source, {}, { name: "Primitives" })

      expect(groups).toEqual({
        Palette: {
          Neutral: { t0: "#ffffff", t100: "#09090b" },
          Blue: { t60: "#0f62fe" },
        },
        Spacing: { xs: "4px", sm: "8px", md: "12px" },
      })
    })
  })

  describe("given semantic tokens with aliases and light-dark", () => {
    const source = `Colors {
  Bg {
    canvas:  light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t100});
    surface: {$Palette.Neutral.t0};
  }
}`

    it("then keeps {$...} aliases and light-dark() values verbatim", async () => {
      const { groups } = await compiler.compile(source, {}, { name: "Semantic" })

      expect(groups).toEqual({
        Colors: {
          Bg: {
            canvas: "light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t100})",
            surface: "{$Palette.Neutral.t0}",
          },
        },
      })
    })
  })

  describe("given a @font-face artifact", () => {
    const source = `FontFamilies { sans: "Inter", system-ui; }
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter.woff2") format("woff2");
  font-weight: 400 700;
}`

    it("then collects it beside the groups as a descriptor map", async () => {
      const definition = await compiler.compile(source, {}, { name: "Primitives" })

      expect(definition.groups).toEqual({ FontFamilies: { sans: '"Inter", system-ui' } })
      expect(definition.fontFaces).toEqual([
        {
          "font-family": '"Inter"',
          src: 'url("/fonts/Inter.woff2") format("woff2")',
          "font-weight": "400 700",
        },
      ])
    })
  })

  describe("given a @keyframes timeline with {prop}", () => {
    const source = `@keyframes pulse {
  from, to { transform: scale(1); }
  50%      { transform: scale({pulseScale}); }
}`

    it("then emits a keyframes artifact keyed by name with frame selectors intact", async () => {
      const definition = await compiler.compile(source, {}, { name: "Motion" })

      expect(definition.keyframes).toEqual({
        pulse: {
          "from, to": { transform: "scale(1)" },
          "50%": { transform: "scale({pulseScale})" },
        },
      })
    })
  })

  describe("given a @counter-style artifact", () => {
    it("then keys it by name with its descriptors", async () => {
      const definition = await compiler.compile(
        "@counter-style my-counter { system: cyclic; symbols: '*'; }",
        {},
        { name: "Primitives" },
      )

      expect(definition.counterStyles).toEqual({ "my-counter": { system: "cyclic", symbols: "'*'" } })
    })
  })

  describe("given same-named sibling groups in one file", () => {
    it("then merges them as long as leaves stay disjoint", async () => {
      const { groups } = await compiler.compile("Colors { Bg { a: 1; } }\nColors { Text { b: 2; } }", {}, {})

      expect(groups).toEqual({ Colors: { Bg: { a: "1" }, Text: { b: "2" } } })
    })
  })

  describe("given collisions", () => {
    it("then a duplicate leaf token in the same scope is an error", async () => {
      await expectAsync(compiler.compile("Colors { bg: red; bg: blue; }", {}, {})).toBeRejectedWithError(
        HeleonixThemeCompilerError,
        /Duplicate theme token 'bg'/,
      )
    })

    it("then a token name reused as a group is an error", async () => {
      await expectAsync(compiler.compile("Colors { bg: red; bg { x: 1; } }", {}, {})).toBeRejectedWithError(
        /Duplicate theme token 'bg'/,
      )
    })

    it("then a duplicate @keyframes name is an error", async () => {
      await expectAsync(
        compiler.compile("@keyframes pulse { from { x: 1; } }\n@keyframes pulse { to { x: 2; } }", {}, {}),
      ).toBeRejectedWithError(/Duplicate theme '@keyframes' artifact named 'pulse'/)
    })
  })

  describe("given an unsupported at-rule", () => {
    it("then rejects @media in a theme", async () => {
      await expectAsync(compiler.compile("@media print { x: 1; }", {}, {})).toBeRejectedWithError(/@media/)
    })
  })

  describe("given usage frontmatter and a dimension", () => {
    const source = `---
usage: override
---
Palette { Blue { t60: #ff0000; } }`

    it("then reads the usage and dimension", async () => {
      const definition = await compiler.compile(source, { customer: "customer2" }, { name: "Brand" })

      expect(definition.name).toBe("Brand")
      expect(definition.dimension).toEqual({ customer: "customer2" })
      expect(definition.usage).toBe("override")
    })
  })

  describe("given a base partial and a brand overlay", () => {
    it("then Merger.mergeDeeply overlays only the overridden leaves", async () => {
      const base = await compiler.compile(
        "Palette { Blue { t60: #0f62fe; t70: #0043ce; } }",
        {},
        { name: "Primitives" },
      )
      const overlay = await compiler.compile(
        "Palette { Blue { t60: #7c3aed; } }",
        { customer: "customer2" },
        { name: "Brand" },
      )

      expect(Merger.mergeDeeply(base.groups, overlay.groups)).toEqual({
        Palette: { Blue: { t60: "#7c3aed", t70: "#0043ce" } },
      })
    })
  })
})
