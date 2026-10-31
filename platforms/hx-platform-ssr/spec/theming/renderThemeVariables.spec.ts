import { renderThemeVariables } from "@heleonix/hx-platform-ssr"

describe("renderThemeVariables", () => {
  it("then renders each token under the custom property the classes reference", () => {
    expect(renderThemeVariables(new Map([["hx-palette-blue-t60", "#0f62fe"]]))).toBe("--hx-palette-blue-t60: #0f62fe")
  })

  it("then renders an alias as a var() chain, like the web", () => {
    expect(renderThemeVariables(new Map([["hx-colors-primary", "{$Palette.Blue.t60}"]]))).toBe(
      "--hx-colors-primary: var(--hx-palette-blue-t60)",
    )
  })
})
