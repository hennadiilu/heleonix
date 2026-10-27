import { styleVariableName } from "@heleonix/hx-core"
import type { Component, IStyleRule, IStyleVariable } from "@heleonix/hx-core"
import { composeKeyframes, composeRule } from "@heleonix/hx-platform-web"
import {
  SsrElementState,
  SsrStyleDriver,
  SsrStyleEffect,
  renderElementAttributes,
  renderThemeVariables,
} from "@heleonix/hx-platform-ssr"

const components = new Map<string, Component>()

function cmp(fqName: string): Component {
  let component = components.get(fqName)

  if (!component) {
    component = { fqName } as unknown as Component
    components.set(fqName, component)
  }

  return component
}

describe("SsrStyleEffect + renderElementAttributes", () => {
  it("then serializes classes, variables and attributes in write order", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)

    effect.addClass("hx-a")
    effect.setVariable({ name: "hx--some-prop", text: false }, "5")
    effect.setProperty("color", "red")
    effect.setAttribute("data-hx-1a2b", "")

    expect(renderElementAttributes(state)).toBe('class="hx-a" style="--hx--some-prop: 5; color: red" data-hx-1a2b=""')
  })

  it("then drops removed classes and variables symmetrically", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)
    const variable = { name: "hx--p", text: false }

    effect.addClass("hx-a")
    effect.removeClass("hx-a")
    effect.setVariable(variable, "1")
    effect.removeVariable(variable)

    expect(renderElementAttributes(state)).toBe("")
  })
})

describe("renderThemeVariables", () => {
  it("then renders each token under the custom property the classes reference", () => {
    expect(renderThemeVariables(new Map([["hx-palette-blue-t60", "#0f62fe"]]))).toBe("--hx-palette-blue-t60: #0f62fe")
  })

  it("then renders an alias as a var() chain, like the web", () => {
    expect(renderThemeVariables(new Map([["hx-colors-primary", "{$Palette.Blue.t60}"]]))).toBe(
      "--hx-colors-primary: var(--hx-palette-blue-t60)",
    )
  })
})

describe("SsrStyleDriver", () => {
  it("then writes the same rule as the web platform for the same id (hydration parity)", () => {
    const driver = new SsrStyleDriver()
    const rule: IStyleRule = { id: "hx-a", conditions: [{ pseudo: "Hover" }], declarations: { color: "red" } }

    driver.insertRule(rule)

    expect(driver.css()).toBe(composeRule(rule))
  })

  it("then writes keyframes like the web and removes any entry by its id", () => {
    const driver = new SsrStyleDriver()
    const frames = { "50%": { transform: "scale(1.1)" } }

    driver.insertKeyframes("hx-Button-pulse-1", frames)
    driver.insertRule({ id: "hx-a", conditions: [], declarations: { "animation-name": "hx-Button-pulse-1" } })
    expect(driver.css()).toContain(composeKeyframes("hx-Button-pulse-1", frames))

    driver.remove("hx-Button-pulse-1")
    driver.remove("hx-a")
    expect(driver.css()).toBe("")
  })
})

function render(): { css: string; attrs: string } {
  const driver = new SsrStyleDriver()
  const effect = driver.effectFor(cmp("A"))

  driver.insertRule({ id: "hx-a", conditions: [], declarations: { color: "red", width: "{size}px" } })
  effect.addClass("hx-a")
  effect.setVariable({ name: styleVariableName("size", false), text: false }, "5")

  return { css: driver.css(), attrs: renderElementAttributes(driver.stateFor(cmp("A"))) }
}

describe("SSR rendering of a composed style", () => {
  it("then is deterministic across independent renders (hydration idempotence)", () => {
    expect(render()).toEqual(render())
  })

  it("then emits the class and the {prop} value as the inline variable the rule reads", () => {
    const { css, attrs } = render()

    expect(css).toBe(".hx-a { color: red; width: calc(var(--hx--size) * 1px); }")
    expect(attrs).toBe('class="hx-a" style="--hx--size: 5"')
  })
})

describe("SSR dictionary and config values in declarations", () => {
  it("then renders a quoted dictionary entry as an escaped text variable and a config entry as a raw one", () => {
    const driver = new SsrStyleDriver()
    const effect = driver.effectFor(cmp("C"))
    const title: IStyleVariable = { name: styleVariableName("@Labels.title", true), text: true }
    const gap: IStyleVariable = { name: styleVariableName("#Layout.gap", false), text: false }

    driver.insertRule({
      id: "hx-c",
      conditions: [],
      declarations: { content: "'{@Labels.title}'", gap: "{#Layout.gap}px" },
    })
    effect.addClass("hx-c")
    effect.setVariable(title, 'Say "hi" <b>')
    effect.setVariable(gap, "8")

    const text = `--${title.name}`
    const raw = `--${gap.name}`

    expect(driver.css()).toContain(`content: var(${text})`)
    expect(driver.css()).toContain(`gap: calc(var(${raw}) * 1px)`)
    expect(renderElementAttributes(driver.stateFor(cmp("C")))).toContain(
      `${text}: &quot;Say \\&quot;hi\\&quot; &lt;b&gt;&quot;; ${raw}: 8`,
    )
  })
})

describe("renderElementAttributes escaping", () => {
  it("then escapes attribute values so state cannot break out of the markup", () => {
    const state = new SsrElementState()

    state.attributes.set("data-x", '"><script>')

    expect(renderElementAttributes(state)).toBe('data-x="&quot;&gt;&lt;script&gt;"')
  })
})

describe("SSR media queries", () => {
  it("then emits the resolved query as written, never a CSS variable", () => {
    const driver = new SsrStyleDriver()

    driver.insertRule({
      id: "hx-m",
      conditions: [{ environment: "(max-width:600px)" }],
      declarations: { color: "red" },
    })

    expect(driver.css()).toContain("@media (max-width:600px) {")
    expect(driver.css()).not.toContain("var(")
  })

  it("then disables the rule rather than let a resolved value escape into the stylesheet", () => {
    const driver = new SsrStyleDriver()

    driver.insertRule({
      id: "hx-m",
      conditions: [{ environment: "(max-width:1px) { } body { background: redpx)" }],
      declarations: { color: "red" },
    })

    expect(driver.css()).toContain("@media not all {")
    expect(driver.css()).not.toContain("body {")
  })
})
