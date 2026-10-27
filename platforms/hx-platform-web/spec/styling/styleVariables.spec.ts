import { styleVariableName } from "@heleonix/hx-core"
import type { IScheduler } from "@heleonix/hx-core"
import { WebStyleEffect, cssVariableValue, interpolateValue } from "@heleonix/hx-platform-web"

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

const raw = (source: string): string => `--${styleVariableName(source, false)}`
const text = (source: string): string => `--${styleVariableName(source, true)}`

describe("cssVariableValue", () => {
  it("then quotes a text value and escapes quotes, backslashes and newlines", () => {
    expect(cssVariableValue({ name: "hx-x", text: true }, 'Say "hi"\\\nbye')).toBe('"Say \\"hi\\"\\\\\\A bye"')
  })

  it("then passes a safe raw value through", () => {
    expect(cssVariableValue({ name: "hx-x", text: false }, "calc(8px + 2px)")).toBe("calc(8px + 2px)")
  })

  it("then rejects a raw value that could escape its declaration or inject behavior", () => {
    for (const value of ["red; background: blue", "red}", "red !important", "url(evil.png)", "expression(alert(1))"]) {
      expect(cssVariableValue({ name: "hx-x", text: false }, value))
        .withContext(value)
        .toBeUndefined()
    }
  })

  it("then makes any text safe by quoting rather than rejecting it", () => {
    expect(cssVariableValue({ name: "hx-x", text: true }, "a; } url(")).toBe('"a; } url("')
  })
})

describe("interpolateValue with per-instance and text variables", () => {
  it("then reads unquoted dictionary and config sources from their per-instance variables", () => {
    expect(interpolateValue("{#Layout.gap} {@Labels.size}")).toBe(
      `var(${raw("#Layout.gap")}) var(${raw("@Labels.size")})`,
    )
  })

  it("then still reads theme tokens from the theme's variables and properties from theirs", () => {
    expect(interpolateValue("{$Colors.primary} {someProp}")).toBe("var(--hx-colors-primary) var(--hx--some-prop)")
  })

  it("then keeps a property apart from a theme token of the same slug, so it cannot shadow the token", () => {
    expect(interpolateValue("{spacingSm} {$Spacing.sm}")).toBe("var(--hx--spacing-sm) var(--hx-spacing-sm)")
  })

  it("then folds a unit suffix into calc for any source", () => {
    expect(interpolateValue("{#Layout.gap}px {size}%")).toBe(
      `calc(var(${raw("#Layout.gap")}) * 1px) calc(var(--hx--size) * 1%)`,
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

    effect.setVariable({ name: styleVariableName("@Labels.title", true), text: true }, "Hello")

    expect(root.style.props.get(text("@Labels.title"))).toBe('"Hello"')
  })

  it("then leaves an unsafe raw value unset, clearing any earlier safe value", () => {
    const { root, effect } = rootWith()
    const variable = { name: styleVariableName("#Theme.accent", false), text: false }

    effect.setVariable(variable, "red")
    effect.setVariable(variable, "red; background: url(x)")

    expect(root.style.props.has(raw("#Theme.accent"))).toBeFalse()
  })
})
