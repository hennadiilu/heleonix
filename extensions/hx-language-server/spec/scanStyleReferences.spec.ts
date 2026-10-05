import { scanStyleReferences } from "../src/references/scanStyleReferences"

function refs(source: string): string[] {
  return scanStyleReferences(source).map(
    (ref) => `${ref.kind}:${ref.name}.${ref.entry}=${source.slice(ref.start, ref.end)}`,
  )
}

describe("scanStyleReferences", () => {
  it("then finds dictionary and config references in declaration values", () => {
    expect(refs("content: '{@Labels.title}';\npadding: {#Layout.gap};")).toEqual([
      "dictionary:Labels.title=@Labels.title",
      "config:Layout.gap=#Layout.gap",
    ])
  })

  it("then finds references in qualifier arguments and keyframe values", () => {
    expect(
      refs(
        "@hx-if(value: {variant}, is: {@Labels.primary}) { color: red; }\n@keyframes k { to { width: {#Sizes.max}; } }",
      ),
    ).toEqual(["dictionary:Labels.primary=@Labels.primary", "config:Sizes.max=#Sizes.max"])
  })

  it("then spans only the source, without braces, padding or a converter pipe", () => {
    const source = "color: { @Labels.title | upper };"

    expect(refs(source)).toEqual(["dictionary:Labels.title=@Labels.title"])
  })

  it("then splits the entry off the last separator", () => {
    expect(scanStyleReferences("x: {#App.Layout.gap};")[0]).toEqual(
      jasmine.objectContaining({ kind: "config", name: "App.Layout", entry: "gap" }),
    )
  })

  it("then ignores theme tokens, state reads, hex colors and at-rules", () => {
    expect(
      refs("color: {$Colors.Text.primary};\nwidth: {size}px;\nborder-color: #0f62fe;\n@media (max-width: 1px) {}"),
    ).toEqual([])
  })

  it("then never reads a block body that starts with a qualifier as a reference", () => {
    expect(refs("@hx-if(value: {x}) { @hx-apply(token: Type.Body); }")).toEqual([])
  })

  it("then ignores references inside block and line comments", () => {
    expect(refs("/* {@Labels.a} */\n// {@Labels.b}\ncolor: {@Labels.c};")).toEqual(["dictionary:Labels.c=@Labels.c"])
  })

  it("then keeps a reference inside a quoted value live, and comment markers inside strings inert", () => {
    expect(refs("content: '// {@Labels.a}';")).toEqual(["dictionary:Labels.a=@Labels.a"])
  })

  it("then treats `//` inside parentheses as content, not a comment", () => {
    expect(refs("background: url(http://x.test/a.png); color: {@Labels.c};")).toEqual(["dictionary:Labels.c=@Labels.c"])
  })

  it("then skips an incomplete reference with no entry", () => {
    expect(refs("color: {@Labels};")).toEqual([])
  })
})
