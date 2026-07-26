import { pseudoFragment, mediaFragment, QualifierRegistry, buildFragments } from "@heleonix/hx-core"

describe("pseudoFragment", () => {
  it("then maps a bare pseudo to a neutral pseudo fragment", () => {
    expect(pseudoFragment({ name: "Hover", args: {} })).toEqual({ pseudo: "Hover" })
  })

  it("then keeps a functional pseudo's positional argument", () => {
    expect(pseudoFragment({ name: "NthChild", args: {}, positional: "2n" })).toEqual({ pseudo: "NthChild(2n)" })
  })
})

describe("mediaFragment", () => {
  it("then maps a media query to a neutral environment fragment", () => {
    expect(mediaFragment({ name: "Media", args: { query: "(max-width:600px)" } })).toEqual({
      environment: "(max-width:600px)",
    })
  })
})

describe("QualifierRegistry default (pseudo family)", () => {
  it("then routes unregistered segment names to the default, keeping explicit qualifiers", () => {
    const registry = new QualifierRegistry()
    registry.register("Media", { build: mediaFragment })
    registry.setDefault({ build: pseudoFragment })

    expect(buildFragments("Hover&Media(query:(max-width:600px))&Before", registry)).toEqual([
      { pseudo: "Hover" },
      { environment: "(max-width:600px)" },
      { pseudo: "Before" },
    ])
  })

  it("then still returns undefined for an unknown name when no default is set", () => {
    expect(new QualifierRegistry().get("Nope")).toBeUndefined()
  })
})
