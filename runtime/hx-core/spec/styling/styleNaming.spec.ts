import { styleVariableName } from "@heleonix/hx-core"
import { hashStyleKey } from "../../src/styling/hashStyleKey"
import { themeVariableName } from "../../src/theming/themeVariableName"
import { variableSlug } from "../../src/styling/variableSlug"

const raw = (source: string): string => styleVariableName(source, false)

const text = (source: string): string => styleVariableName(source, true)

describe("hashStyleKey", () => {
  it("then is deterministic and content-sensitive, in identifier characters", () => {
    expect(hashStyleKey("Hover|{color:red}")).toBe(hashStyleKey("Hover|{color:red}"))
    expect(hashStyleKey("Hover|{color:red}")).not.toBe(hashStyleKey("Hover|{color:blue}"))
    expect(hashStyleKey("Hover|{color:red}")).toMatch(/^[0-9a-z]+$/)
  })

  it("then is wider than 32 bits, so distinct rules of one application keep distinct ids", () => {
    const seen = new Set<string>()

    for (let i = 0; i < 20000; i++) {
      seen.add(hashStyleKey(`[] {"width":"${i}px"}`))
    }

    expect(seen.size).toBe(20000)
    expect([...seen].some((hash) => parseInt(hash, 36) > 2 ** 32)).toBeTrue()
  })
})

describe("variableSlug", () => {
  it("then kebab-cases a path into single-dash segments", () => {
    expect(variableSlug("Colors.Roles.Primary.bg")).toBe("colors-roles-primary-bg")
    expect(variableSlug("someProp")).toBe("some-prop")
    expect(variableSlug("sub.subsub:isInvalid")).toBe("sub-subsub-is-invalid")
  })

  it("then never starts with a dash nor doubles one", () => {
    for (const path of ["_private", "a..b", "a.:b", "A.B", "x_.y", "a.", ".a", "a--b", "a-.b"]) {
      expect(variableSlug(path)).withContext(path).not.toMatch(/^-|--/)
    }
  })
})

describe("themeVariableName", () => {
  it("then publishes a token under its readable hx- path", () => {
    expect(themeVariableName("Colors.Roles.Primary.bg")).toBe("hx-colors-roles-primary-bg")
  })
})

describe("styleVariableName", () => {
  it("then reads an unquoted theme token from the variable its theme publishes", () => {
    expect(raw("$Colors.Roles.Primary.bg")).toBe(themeVariableName("Colors.Roles.Primary.bg"))
  })

  it("then keeps a plain property path readable under the reserved hx-- namespace", () => {
    expect(raw("someProp")).toBe("hx--some-prop")
    expect(raw("sub.subsub:isInvalid")).toBe("hx--sub-subsub-is-invalid")
  })

  it("then never lets a property shadow a theme token of the same slug", () => {
    expect(raw("spacingSm")).not.toBe(raw("$Spacing.sm"))
    expect(raw("colors.primary")).not.toBe(raw("$Colors.primary"))
  })

  it("then names dictionary and config sources readably, with a hash after a double dash", () => {
    expect(raw("@Labels.title")).toMatch(/^hx--dict-labels-title--[0-9a-z]+$/)
    expect(raw("#Layout.gap")).toMatch(/^hx--config-layout-gap--[0-9a-z]+$/)
  })

  it("then never lets a property path imitate a hashed source's name", () => {
    const hashed = raw("@Labels.title")
    const imitation = hashed.replace(/^hx--/, "").replace("--", ".").replace(/-/g, ".")

    expect(raw(imitation)).not.toBe(hashed)
  })

  it("then gives the text and raw forms of one source different names", () => {
    expect(text("@Labels.title")).toMatch(/^hx--dict-labels-title-text--/)
    expect(text("@Labels.title")).not.toBe(raw("@Labels.title"))
    expect(text("someProp")).toMatch(/^hx--some-prop-text--/)
    expect(text("$Fonts.main")).toMatch(/^hx--theme-fonts-main-text--/)
  })

  it("then keeps sources apart whose readable parts would collide", () => {
    expect(raw("@Labels.title | upper")).not.toBe(raw("@Labels.title.upper"))
    expect(text("@Labels.title")).not.toBe(raw("@Labels.title.text"))
  })

  it("then is deterministic, so server and client agree", () => {
    expect(raw("#Layout.gap")).toBe(raw("#Layout.gap"))
  })
})
