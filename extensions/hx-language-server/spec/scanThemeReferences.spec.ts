import { scanThemeReferences } from "../src/references/scanThemeReferences"

function refs(source: string): string[] {
  return scanThemeReferences(source).map((ref) => `${ref.path}=${source.slice(ref.start, ref.end)}`)
}

describe("scanThemeReferences", () => {
  it("then finds tokens in declaration values, media queries, qualifier arguments and keyframes, in order", () => {
    const source = [
      "padding: {$Spacing.xs} {$Spacing.md};",
      "@media {$Media.compact} { gap: 0; }",
      "@hx-if(value: {variant}, is: {$Variants.primary}) { color: red; }",
      "@keyframes k { to { width: {$Sizes.max}; } }",
    ].join("\n")

    expect(refs(source)).toEqual([
      "Spacing.xs=$Spacing.xs",
      "Spacing.md=$Spacing.md",
      "Media.compact=$Media.compact",
      "Variants.primary=$Variants.primary",
      "Sizes.max=$Sizes.max",
    ])
  })

  it("then finds the group an `@hx-apply` expands", () => {
    expect(refs("color: red;\n@hx-apply( token : Type.Body );")).toEqual(["Type.Body=Type.Body"])
  })

  it("then spans only the source, without braces, padding or a converter pipe", () => {
    expect(refs("width: { $Sizes.max | double };")).toEqual(["Sizes.max=$Sizes.max"])
  })

  it("then reads hyphenated leaf names and top-level tokens", () => {
    expect(refs("font-family: {$Type.Body.font-family}; color: {$accent};")).toEqual([
      "Type.Body.font-family=$Type.Body.font-family",
      "accent=$accent",
    ])
  })

  it("then keeps tokens inside quoted strings and skips comments", () => {
    const source = "/* {$Old.token} */\ncontent: '{$Labels.mark} // {$Labels.tail}'; // {$Old.line}\n"

    expect(refs(source)).toEqual(["Labels.mark=$Labels.mark", "Labels.tail=$Labels.tail"])
  })

  it("then ignores dictionary, config and state sources and block bodies", () => {
    expect(refs("content: '{@Labels.title}'; gap: {#Layout.gap}; width: {size}px; :hover { color: red; }")).toEqual([])
  })
})
