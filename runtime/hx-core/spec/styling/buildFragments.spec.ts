import { QualifierRegistry, buildFragments } from "@heleonix/hx-core"
import type { IStyleQualifier, IDisposable } from "@heleonix/hx-core"

const hover: IStyleQualifier = { build: () => ({ pseudo: "Hover" }) }
const media: IStyleQualifier = { build: (usage) => ({ environment: usage.args["query"] }) }
const iff: IStyleQualifier = { attach: (): IDisposable => ({ dispose() {} }) }

function registry(): QualifierRegistry {
  const result = new QualifierRegistry()

  result.register("Hover", hover)
  result.register("Media", media)
  result.register("If", iff)

  return result
}

describe("QualifierRegistry", () => {
  it("then returns the qualifier registered for a name, or undefined", () => {
    const result = registry()

    expect(result.get("Hover")).toBe(hover)
    expect(result.get("Nope")).toBeUndefined()
  })
})

describe("buildFragments", () => {
  it("then dispatches each `&`-segment to its qualifier's build", () => {
    expect(buildFragments("Hover&Media(query:(max-width:600px))", registry())).toEqual([
      { pseudo: "Hover" },
      { environment: "(max-width:600px)" },
    ])
  })

  it("then skips attach-only and unregistered qualifiers", () => {
    expect(buildFragments("If(value:{x})", registry())).toEqual([])
    expect(buildFragments("If(value:{x})&Hover", registry())).toEqual([{ pseudo: "Hover" }])
    expect(buildFragments("Unknown", registry())).toEqual([])
  })

  it("then yields no fragments for the root rule", () => {
    expect(buildFragments("", registry())).toEqual([])
  })
})
