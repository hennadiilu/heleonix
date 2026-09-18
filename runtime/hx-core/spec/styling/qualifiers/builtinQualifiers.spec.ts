import { MediaQualifier, PseudoQualifier } from "@heleonix/hx-core"
import type { IStyleQualifierContext } from "@heleonix/hx-core"
import { QualifierProvider } from "../../../src/styling/qualifiers/QualifierProvider"

const context = {} as IStyleQualifierContext

describe("PseudoQualifier", () => {
  it("then maps a bare pseudo to a neutral pseudo fragment", () => {
    expect(new PseudoQualifier(context).build({ name: "Hover", args: {} })).toEqual({ pseudo: "Hover" })
  })

  it("then keeps a functional pseudo's positional argument", () => {
    expect(new PseudoQualifier(context).build({ name: "NthChild", args: {}, positional: "2n" })).toEqual({
      pseudo: "NthChild(2n)",
    })
  })
})

describe("MediaQualifier", () => {
  it("then maps a media query to a neutral environment fragment", () => {
    expect(new MediaQualifier(context).build({ name: "Media", args: { query: "(max-width:600px)" } })).toEqual({
      environment: "(max-width:600px)",
    })
  })
})

describe("QualifierProvider", () => {
  it("then returns the qualifier registered for a name", () => {
    const media = new MediaQualifier(context)

    expect(new QualifierProvider(new Map([["Media", media]])).get("Media")).toBe(media)
  })

  it("then routes an unregistered name to the default (pseudo family)", () => {
    const pseudo = new PseudoQualifier(context)

    expect(new QualifierProvider(new Map([["Media", new MediaQualifier(context)]]), pseudo).get("Before")).toBe(pseudo)
  })

  it("then still returns undefined for an unknown name when no default is set", () => {
    expect(new QualifierProvider(new Map()).get("Nope")).toBeUndefined()
  })
})
