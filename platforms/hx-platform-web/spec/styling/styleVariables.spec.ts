import type { IScheduler } from "@heleonix/hx-core"
import {
  WebStyleEffect,
  composeClassName,
  cssVariableValue,
  interpolateValue,
  styleVariableName,
} from "@heleonix/hx-platform-web"

const immediate: IScheduler = {
  scheduleCompute: (job) => void job(),
  scheduleCommit: (job) => void job(),
}

class FakeStyle {
  public readonly props = new Map<string, string>()
  public setProperty(name: string, value: string): void {
    this.props.set(name, value)
  }
  public removeProperty(name: string): void {
    this.props.delete(name)
  }
}

const raw = (source: string): string => styleVariableName({ source, text: false })
const text = (source: string): string => styleVariableName({ source, text: true })

describe("styleVariableName", () => {
  it("then keeps the readable name for a plain property path", () => {
    expect(raw("someProp")).toBe("--hx-some-prop")
  })

  it("then names dictionary and config sources readably under the reserved --hx-- namespace", () => {
    expect(raw("@Labels.title")).toMatch(/^--hx--dict-labels-title-[0-9a-z]+$/)
    expect(raw("#Layout.gap")).toMatch(/^--hx--config-layout-gap-[0-9a-z]+$/)
  })

  it("then gives the text and raw forms of one source different names", () => {
    expect(text("@Labels.title")).toMatch(/^--hx--dict-labels-title-text-/)
    expect(text("@Labels.title")).not.toBe(raw("@Labels.title"))
  })

  it("then keeps sources apart whose readable parts would collide", () => {
    expect(raw("@Labels.title | upper")).not.toBe(raw("@Labels.title.upper"))
    expect(text("@Labels.title")).not.toBe(raw("@Labels.title.text"))
  })

  it("then is deterministic, so server and client agree", () => {
    expect(raw("#Layout.gap")).toBe(raw("#Layout.gap"))
  })
})

describe("composeClassName", () => {
  it("then gives a rule whose environment resolved differently its own class", () => {
    const declarations = { color: "red" }

    expect(
      composeClassName("Media(query:(max-width:{$B.m}))", [{ environment: "(max-width:600px)" }], declarations),
    ).not.toBe(
      composeClassName("Media(query:(max-width:{$B.m}))", [{ environment: "(max-width:720px)" }], declarations),
    )
  })

  it("then is deterministic for the same compose input", () => {
    expect(composeClassName("Hover", [{ pseudo: "Hover" }], { color: "red" })).toBe(
      composeClassName("Hover", [{ pseudo: "Hover" }], { color: "red" }),
    )
  })
})

describe("cssVariableValue", () => {
  it("then quotes a text value and escapes quotes, backslashes and newlines", () => {
    expect(cssVariableValue({ source: "x", text: true }, 'Say "hi"\\\nbye')).toBe('"Say \\"hi\\"\\\\\\A bye"')
  })

  it("then passes a safe raw value through", () => {
    expect(cssVariableValue({ source: "x", text: false }, "calc(8px + 2px)")).toBe("calc(8px + 2px)")
  })

  it("then rejects a raw value that could escape its declaration or inject behavior", () => {
    for (const value of ["red; background: blue", "red}", "red !important", "url(evil.png)", "expression(alert(1))"]) {
      expect(cssVariableValue({ source: "x", text: false }, value))
        .withContext(value)
        .toBeUndefined()
    }
  })

  it("then makes any text safe by quoting rather than rejecting it", () => {
    expect(cssVariableValue({ source: "x", text: true }, "a; } url(")).toBe('"a; } url("')
  })
})

describe("interpolateValue with per-instance and text variables", () => {
  it("then reads unquoted dictionary and config sources from their per-instance variables", () => {
    expect(interpolateValue("{#Layout.gap} {@Labels.size}")).toBe(
      `var(${raw("#Layout.gap")}) var(${raw("@Labels.size")})`,
    )
  })

  it("then still reads theme tokens from the theme's variables and properties from theirs", () => {
    expect(interpolateValue("{$Colors.primary} {someProp}")).toBe("var(--hx-colors-primary) var(--hx-some-prop)")
  })

  it("then folds a unit suffix into calc for any source", () => {
    expect(interpolateValue("{#Layout.gap}px {size}%")).toBe(
      `calc(var(${raw("#Layout.gap")}) * 1px) calc(var(--hx-size) * 1%)`,
    )
  })

  it("then replaces a string that is one source with its text variable", () => {
    expect(interpolateValue("'{@Labels.title}'")).toBe(`var(${text("@Labels.title")})`)
  })

  it("then splits a string around its sources, keeping the literal pieces and their quote", () => {
    expect(interpolateValue("'Hi, {name}!'")).toBe(`'Hi, ' var(${text("name")}) '!'`)
  })

  it("then delivers a quoted theme token as text too", () => {
    expect(interpolateValue('"{$Fonts.main}"')).toBe(`var(${text("$Fonts.main")})`)
  })

  it("then leaves strings without sources untouched", () => {
    expect(interpolateValue(`'a "b"' "c"`)).toBe(`'a "b"' "c"`)
  })
})

describe("WebStyleEffect variables", () => {
  function rootWith(): { root: { style: FakeStyle }; effect: WebStyleEffect } {
    const root = { style: new FakeStyle() }

    return {
      root,
      effect: new WebStyleEffect([root] as unknown as ConstructorParameters<typeof WebStyleEffect>[0], immediate),
    }
  }

  it("then sets a text variable as a quoted CSS string", () => {
    const { root, effect } = rootWith()

    effect.setVariable({ source: "@Labels.title", text: true }, "Hello")

    expect(root.style.props.get(text("@Labels.title"))).toBe('"Hello"')
  })

  it("then leaves an unsafe raw value unset, clearing any earlier safe value", () => {
    const { root, effect } = rootWith()
    const variable = { source: "#Theme.accent", text: false }

    effect.setVariable(variable, "red")
    effect.setVariable(variable, "red; background: url(x)")

    expect(root.style.props.has(raw("#Theme.accent"))).toBeFalse()
  })
})
