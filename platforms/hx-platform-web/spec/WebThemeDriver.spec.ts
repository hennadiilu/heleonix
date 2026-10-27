import { WebThemeDriver } from "@heleonix/hx-platform-web"
import type { WebAppHost } from "@heleonix/hx-platform-web"

function driverWith(): { driver: WebThemeDriver; published: Map<string, string> } {
  const published = new Map<string, string>()
  const host = {
    publishVariable: (property: string, value: string): void => void published.set(property, value),
  }

  return { driver: new WebThemeDriver(host as unknown as WebAppHost), published }
}

describe("WebThemeDriver", () => {
  it("then publishes each token under its custom property name", () => {
    const { driver, published } = driverWith()

    driver.applyTokens(new Map([["hx-palette-blue-t60", "#0f62fe"]]))

    expect([...published]).toEqual([["--hx-palette-blue-t60", "#0f62fe"]])
  })

  it("then publishes an alias as a var() chain to the token it names", () => {
    const { driver, published } = driverWith()

    driver.applyTokens(
      new Map([
        ["hx-colors-primary", "{$Palette.Blue.t60}"],
        ["hx-colors-surface", "light-dark({$Palette.Neutral.t0}, {$Palette.Neutral.t100})"],
      ]),
    )

    expect(published.get("--hx-colors-primary")).toBe("var(--hx-palette-blue-t60)")
    expect(published.get("--hx-colors-surface")).toBe(
      "light-dark(var(--hx-palette-neutral-t0), var(--hx-palette-neutral-t100))",
    )
  })

  it("then publishes a plain value unchanged", () => {
    const { driver, published } = driverWith()

    driver.applyTokens(new Map([["hx-fonts-body", "'Inter', sans-serif"]]))

    expect(published.get("--hx-fonts-body")).toBe("'Inter', sans-serif")
  })
})
