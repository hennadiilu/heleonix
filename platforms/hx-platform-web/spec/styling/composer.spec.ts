import type { StyleFragment } from "@heleonix/hx-core"
import {
  mangleVariable,
  interpolateValue,
  composeSelector,
  composeRule,
  composeKeyframes,
  composeFontFace,
  composeCounterStyle,
  composeThemeArtifacts,
  scopedKeyframeName,
  rewriteAnimationRefs,
  vendorPrefixes,
  declarationsToCss,
  hashClassName,
} from "@heleonix/hx-platform-web"

describe("mangleVariable", () => {
  it("then kebab-cases theme paths and state props into --hx- variables", () => {
    expect(mangleVariable("Colors.Roles.Primary.bg")).toBe("--hx-colors-roles-primary-bg")
    expect(mangleVariable("someProp")).toBe("--hx-some-prop")
    expect(mangleVariable("sub.subsub:isInvalid")).toBe("--hx-sub-subsub-is-invalid")
  })
})

describe("interpolateValue", () => {
  it("then turns theme and state sources into var() chains, keeping literals", () => {
    expect(interpolateValue("10px {someProp} {$Colors.Roles.Primary.bg}")).toBe(
      "10px var(--hx-some-prop) var(--hx-colors-roles-primary-bg)",
    )
  })

  it("then wraps a source glued to a unit in calc()", () => {
    expect(interpolateValue("{someProp}px")).toBe("calc(var(--hx-some-prop) * 1px)")
  })

  it("then interpolates each source inside a function, preserving punctuation", () => {
    expect(interpolateValue("light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t100})")).toBe(
      "light-dark(var(--hx-palette-neutral-t10), var(--hx-palette-neutral-t100))",
    )
  })
})

describe("composeSelector", () => {
  it("then attaches pseudo-classes and gates, serializing the pseudo-element last", () => {
    const fragments: StyleFragment[] = [{ pseudo: "Before" }, { pseudo: "Hover" }, { gate: "1a2b" }]

    // The gate id is used verbatim (it is already an attribute-safe slug that
    // must match what the qualifier's `attach` toggles).
    expect(composeSelector("hx-abc", fragments)).toBe(".hx-abc:hover[data-hx-1a2b]::before")
  })

  it("then keeps a functional pseudo's argument", () => {
    expect(composeSelector("hx-abc", [{ pseudo: "NthChild(2n)" }])).toBe(".hx-abc:nth-child(2n)")
  })
})

describe("composeRule", () => {
  it("then builds the declaration body with interpolated values", () => {
    expect(composeRule("hx-abc", [{ pseudo: "Hover" }], { color: "{$Colors.Text.default}", padding: "4px" })).toBe(
      ".hx-abc:hover { color: var(--hx-colors-text-default); padding: 4px; }",
    )
  })

  it("then wraps the rule in @media for an environment fragment, interpolating the query", () => {
    const fragments: StyleFragment[] = [{ environment: "(max-width:{$Breakpoints.mobile})" }]

    expect(composeRule("hx-abc", fragments, { width: "4px" })).toBe(
      "@media (max-width:var(--hx-breakpoints-mobile)) { .hx-abc { width: 4px; } }",
    )
  })
})

describe("composeKeyframes", () => {
  it("then serializes each frame selector with interpolated declarations", () => {
    const frames = {
      "from, to": { transform: "scale(1)" },
      "50%": { transform: "scale({pulseScale})" },
    }

    expect(composeKeyframes("hx-Button-pulse", frames)).toBe(
      "@keyframes hx-Button-pulse { from, to { transform: scale(1); } 50% { transform: scale(var(--hx-pulse-scale)); } }",
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
      "@keyframes pulse { 50% { transform: scale(var(--hx-pulse-scale)); } }\n" +
        '@font-face { font-family: "Inter"; src: url(/inter.woff2); }\n' +
        "@counter-style thumbs { system: cyclic; }",
    )
  })

  it("then yields an empty string when the theme has no artifacts", () => {
    expect(composeThemeArtifacts({})).toBe("")
  })
})

describe("scopedKeyframeName", () => {
  it("then namespaces a style-local timeline by its scope", () => {
    expect(scopedKeyframeName("Button", "pulse")).toBe("hx-Button-pulse")
  })
})

describe("rewriteAnimationRefs", () => {
  it("then scopes only tokens naming a local keyframe, in name and shorthand", () => {
    const declarations = {
      "animation-name": "pulse, spin",
      animation: "2s ease pulse",
      color: "pulse",
    }

    expect(rewriteAnimationRefs(declarations, ["pulse"], "Button")).toEqual({
      "animation-name": "hx-Button-pulse, spin",
      animation: "2s ease hx-Button-pulse",
      color: "pulse",
    })
  })

  it("then leaves declarations untouched when the style has no local keyframes", () => {
    expect(rewriteAnimationRefs({ "animation-name": "pulse" }, [], "Button")).toEqual({ "animation-name": "pulse" })
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

describe("hashClassName", () => {
  it("then is deterministic and content-sensitive", () => {
    expect(hashClassName("Hover|{color:red}")).toBe(hashClassName("Hover|{color:red}"))
    expect(hashClassName("Hover|{color:red}")).not.toBe(hashClassName("Hover|{color:blue}"))
    expect(hashClassName("Hover|{color:red}")).toMatch(/^hx-[0-9a-z]+$/)
  })
})
