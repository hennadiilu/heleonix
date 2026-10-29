import { resolveThemeNode } from "@heleonix/hx-language"

const groups = {
  Palette: { Blue: { t60: "#0f62fe" } },
  Typography: { Heading: { "font-size": "2rem" } },
}

describe("resolveThemeNode", () => {
  it("then resolves a dot-path to a leaf value", () => {
    expect(resolveThemeNode(groups, "Palette.Blue.t60")).toBe("#0f62fe")
  })

  it("then resolves a dot-path to a nested group", () => {
    expect(resolveThemeNode(groups, "Typography.Heading")).toEqual({ "font-size": "2rem" })
  })

  it("then returns undefined for a missing segment", () => {
    expect(resolveThemeNode(groups, "Palette.Red.t60")).toBeUndefined()
  })

  it("then returns undefined when descending through a leaf", () => {
    expect(resolveThemeNode(groups, "Palette.Blue.t60.deeper")).toBeUndefined()
  })
})
