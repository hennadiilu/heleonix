import { parseBindingExpression, REFERENCE_TYPES, THEME_REF_PREFIX, THEME_ENTRY_SEPARATOR } from "@heleonix/hx-language"

describe("parseBindingExpression (theme source)", () => {
  describe("given a `$`-prefixed source", () => {
    describe("when it is parsed", () => {
      it("then classifies it as a theme reference and strips the prefix", () => {
        const result = parseBindingExpression("$Colors.Roles.Primary.bg")

        expect(result.type).toBe("theme")
        expect(result.value).toBe("Colors.Roles.Primary.bg")
      })
    })

    describe("when it carries converters", () => {
      it("then keeps the theme type and collects the converters", () => {
        const result = parseBindingExpression("$Spacing.xs | Double")

        expect(result.type).toBe("theme")
        expect(result.value).toBe("Spacing.xs")
        expect(result.converters).toEqual(["Double"])
      })
    })
  })

  describe("given the theme constants", () => {
    it("then theme has its own prefix and separator, kept out of the named-reference registry", () => {
      expect(THEME_REF_PREFIX).toBe("$")
      expect(THEME_ENTRY_SEPARATOR).toBe(".")
      expect(REFERENCE_TYPES).not.toContain("theme")
    })
  })

  describe("given non-theme sources", () => {
    it("then dictionary/config/state/literal are unaffected", () => {
      expect(parseBindingExpression("@Dict.key").type).toBe("dictionary")
      expect(parseBindingExpression("#Config.path").type).toBe("config")
      expect(parseBindingExpression("someProp").type).toBe("state")
      expect(parseBindingExpression("42").type).toBe("literal")
    })
  })
})
