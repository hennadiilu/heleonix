import type { StyleCondition } from "@heleonix/hx-core"
import {
  interpolateValue,
  composeSelector,
  composeRule,
  composeKeyframes,
  composeFontFace,
  composeCounterStyle,
  composeThemeArtifacts,
  vendorPrefixes,
  declarationsToCss,
} from "@heleonix/hx-platform-web"

describe("interpolateValue", () => {
  it("then turns theme and state sources into var() chains, keeping literals", () => {
    expect(interpolateValue("10px {someProp} {$Colors.Roles.Primary.bg}")).toBe(
      "10px var(--hx--some-prop) var(--hx-colors-roles-primary-bg)",
    )
  })

  it("then wraps a source glued to a unit in calc()", () => {
    expect(interpolateValue("{someProp}px")).toBe("calc(var(--hx--some-prop) * 1px)")
  })

  it("then interpolates each source inside a function, preserving punctuation", () => {
    expect(interpolateValue("light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t100})")).toBe(
      "light-dark(var(--hx-palette-neutral-t10), var(--hx-palette-neutral-t100))",
    )
  })
})

describe("composeSelector", () => {
  it("then attaches pseudo-classes and gates, serializing the pseudo-element last", () => {
    const conditions: StyleCondition[] = [{ pseudo: "Before" }, { pseudo: "Hover" }, { gate: "1a2b" }]

    // The gate id is used verbatim (it is already an attribute-safe slug that
    // must match what the qualifier's `attach` toggles).
    expect(composeSelector("hx-abc", conditions)).toBe(".hx-abc:hover[data-hx-1a2b]::before")
  })

  it("then keeps a functional pseudo's argument", () => {
    expect(composeSelector("hx-abc", [{ pseudo: "NthChild(2n)" }])).toBe(".hx-abc:nth-child(2n)")
  })
})

describe("composeRule", () => {
  it("then builds the declaration body with interpolated values", () => {
    expect(
      composeRule({
        id: "hx-abc",
        conditions: [{ pseudo: "Hover" }],
        declarations: { color: "{$Colors.Text.default}", padding: "4px" },
      }),
    ).toBe(".hx-abc:hover { color: var(--hx-colors-text-default); padding: 4px; }")
  })

  it("then wraps the rule in @media for an environment condition, keeping the resolved query", () => {
    const conditions: StyleCondition[] = [{ environment: "(max-width:600px) and (400px <= height <= 700px)" }]

    expect(composeRule({ id: "hx-abc", conditions, declarations: { width: "4px" } })).toBe(
      "@media (max-width:600px) and (400px <= height <= 700px) { .hx-abc { width: 4px; } }",
    )
  })

  it("then never applies a query whose source stayed unresolved, rather than emitting var()", () => {
    const conditions: StyleCondition[] = [{ environment: "(max-width:{$Breakpoints.missing})" }]

    expect(composeRule({ id: "hx-abc", conditions, declarations: { width: "4px" } })).toBe(
      "@media not all { .hx-abc { width: 4px; } }",
    )
  })

  it("then never lets a resolved value escape the condition into the stylesheet", () => {
    for (const environment of [
      "(max-width:1px) { } body { color: red",
      "(max-width:1px); @import x",
      "(max-width:1px) /* swallow the rest",
      "(max-width:1px) </style><script>",
    ]) {
      expect(composeRule({ id: "hx-abc", conditions: [{ environment }], declarations: { width: "4px" } }))
        .withContext(environment)
        .toBe("@media not all { .hx-abc { width: 4px; } }")
    }
  })
})

describe("composeKeyframes", () => {
  it("then serializes each frame selector with interpolated declarations", () => {
    const frames = {
      "from, to": { transform: "scale(1)" },
      "50%": { transform: "scale({pulseScale})" },
    }

    expect(composeKeyframes("hx-Button-pulse", frames)).toBe(
      "@keyframes hx-Button-pulse { from, to { transform: scale(1); } 50% { transform: scale(var(--hx--pulse-scale)); } }",
    )
  })
})

describe("composeFontFace", () => {
  it("then serializes a descriptor map into an @font-face at-rule", () => {
    expect(composeFontFace({ "font-family": '"Inter"', src: "url(/fonts/inter.woff2)" })).toBe(
      '@font-face { font-family: "Inter"; src: url(/fonts/inter.woff2); }',
    )
  })
})

describe("composeCounterStyle", () => {
  it("then serializes descriptors into a named @counter-style at-rule", () => {
    expect(composeCounterStyle("thumbs", { system: "cyclic", symbols: '"\\1F44D"', suffix: '" "' })).toBe(
      '@counter-style thumbs { system: cyclic; symbols: "\\1F44D"; suffix: " "; }',
    )
  })
})

describe("composeThemeArtifacts", () => {
  it("then emits keyframes, font-faces and counter-styles in that order", () => {
    const css = composeThemeArtifacts({
      keyframes: { pulse: { "50%": { transform: "scale({pulseScale})" } } },
      fontFaces: [{ "font-family": '"Inter"', src: "url(/inter.woff2)" }],
      counterStyles: { thumbs: { system: "cyclic" } },
    })

    expect(css).toBe(
      "@keyframes pulse { 50% { transform: scale(var(--hx--pulse-scale)); } }\n" +
        '@font-face { font-family: "Inter"; src: url(/inter.woff2); }\n' +
        "@counter-style thumbs { system: cyclic; }",
    )
  })

  it("then yields an empty string when the theme has no artifacts", () => {
    expect(composeThemeArtifacts({})).toBe("")
  })
})

describe("vendorPrefixes / declarationsToCss", () => {
  it("then emits a -webkit- alias ahead of a prefixed property, interpolating the value", () => {
    expect(declarationsToCss({ "user-select": "none", color: "{$Colors.Text.default}" })).toBe(
      "-webkit-user-select: none; user-select: none; color: var(--hx-colors-text-default);",
    )
  })

  it("then returns no prefixes for an unprefixed property", () => {
    expect(vendorPrefixes("color")).toEqual([])
  })
})
