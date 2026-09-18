import { parseRuleKey, stringifyRuleKey } from "@heleonix/hx-language"

describe("parseRuleKey", () => {
  describe("given the empty root key", () => {
    it("then yields no usages", () => {
      expect(parseRuleKey("")).toEqual([])
      expect(parseRuleKey("   ")).toEqual([])
    })
  })

  describe("given a bare pseudo segment", () => {
    it("then parses just the name", () => {
      expect(parseRuleKey("Hover")).toEqual([{ name: "Hover", args: {} }])
    })
  })

  describe("given an AND-joined key", () => {
    it("then splits on top-level `&` preserving order", () => {
      expect(parseRuleKey("Hover&Before")).toEqual([
        { name: "Hover", args: {} },
        { name: "Before", args: {} },
      ])
    })
  })

  describe("given a functional pseudo", () => {
    it("then keeps the positional argument verbatim", () => {
      expect(parseRuleKey("NthChild(2n+1)")).toEqual([{ name: "NthChild", args: {}, positional: "2n+1" }])
    })

    it("then treats a leading-colon argument as positional", () => {
      expect(parseRuleKey("Not(:hover)")).toEqual([{ name: "Not", args: {}, positional: ":hover" }])
    })

    it("then keeps a comma selector list in one positional value", () => {
      expect(parseRuleKey("Is(.a,.b)")).toEqual([{ name: "Is", args: {}, positional: ".a,.b" }])
    })
  })

  describe("given named-argument qualifiers", () => {
    it("then parses a single named argument", () => {
      expect(parseRuleKey("If(value:{isInvalid})")).toEqual([{ name: "If", args: { value: "{isInvalid}" } }])
    })

    it("then parses multiple named arguments split on top-level commas", () => {
      expect(parseRuleKey("If(is:{'primary'},value:{variant})")).toEqual([
        { name: "If", args: { is: "{'primary'}", value: "{variant}" } },
      ])
    })

    it("then keeps a scope path verbatim", () => {
      expect(parseRuleKey("Style(for:head.menu.item)")).toEqual([{ name: "Style", args: { for: "head.menu.item" } }])
    })
  })

  describe("given a media query with opaque punctuation", () => {
    it("then keeps colons and parens inside the value", () => {
      expect(parseRuleKey("Media(query:(max-width:{$Breakpoints.mobile}))")).toEqual([
        { name: "Media", args: { query: "(max-width:{$Breakpoints.mobile})" } },
      ])
    })

    it("then keeps a comma-separated query list in one value (comma not followed by `ident:`)", () => {
      expect(parseRuleKey("Media(query:(400px <= width <= 700px),print)")).toEqual([
        { name: "Media", args: { query: "(400px <= width <= 700px),print" } },
      ])
    })
  })

  describe("given a nested scope + media key", () => {
    it("then splits only the top-level `&`", () => {
      expect(parseRuleKey("Style(for:CustomSubCmpnt.Button)&Media(query:(max-width:600px))")).toEqual([
        { name: "Style", args: { for: "CustomSubCmpnt.Button" } },
        { name: "Media", args: { query: "(max-width:600px)" } },
      ])
    })
  })
})

describe("stringifyRuleKey (round-trip)", () => {
  const canonicalKeys = [
    "",
    "Hover",
    "Hover&Before",
    "NthChild(2n)",
    "Not(:hover)",
    "Is(.a,.b)",
    "If(value:{isInvalid})",
    "If(is:{'primary'},value:{variant})",
    "If(isNot:{'danger'},value:{variant})",
    "Style(for:head)",
    "Style(for:head.menu.item)",
    "Style(for:Component)",
    "Media(query:print)",
    "Media(query:(max-width:{$Breakpoints.mobile}))",
    "Media(query:(400px <= width <= 700px),print)",
    "Style(for:CustomSubCmpnt.Button)&Media(query:(max-width:600px))",
  ]

  for (const key of canonicalKeys) {
    it(`then stringify(parse("${key}")) === "${key}"`, () => {
      expect(stringifyRuleKey(parseRuleKey(key))).toBe(key)
    })
  }

  describe("given unsorted named arguments", () => {
    it("then canonicalizes by sorting argument names", () => {
      expect(stringifyRuleKey(parseRuleKey("If(value:{variant},is:{'primary'})"))).toBe(
        "If(is:{'primary'},value:{variant})",
      )
    })
  })
})
