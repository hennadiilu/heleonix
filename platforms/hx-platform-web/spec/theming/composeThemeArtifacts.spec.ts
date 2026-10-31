import { composeFontFace, composeCounterStyle, composeThemeArtifacts } from "@heleonix/hx-platform-web"

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
