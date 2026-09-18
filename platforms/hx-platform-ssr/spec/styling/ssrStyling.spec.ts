import { StyleManager } from "../../../../runtime/hx-core/src/styling/StyleManager"
import type { Component, IQualifierProvider, IState, StyleHandle } from "@heleonix/hx-core"
import { composeRule, hashClassName } from "@heleonix/hx-platform-web"
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

function handle(className: string): StyleHandle {
  return { className } as unknown as StyleHandle
}

const NO_EVENTS = { on: () => {}, off: () => {} }

const NO_QUALIFIERS: IQualifierProvider = { get: () => undefined }

function stateWith(values: Record<string, unknown>): IState {
  return {
    changed: NO_EVENTS,
    getValue: (name: string) => values[name],
    setValue: () => {},
    emitEvent: () => {},
  } as unknown as IState
}

function managerWith(driver: SsrStyleDriver, values: Record<string, unknown> = {}): StyleManager {
  return new StyleManager(
    () => driver,
    { loadDefinition: () => Promise.resolve(undefined) } as never,
    { getTheme: () => Promise.resolve(undefined) } as never,
    stateWith(values),
    NO_QUALIFIERS,
    { resolve: () => [] },
  )
}

describe("SsrStyleEffect + renderElementAttributes", () => {
  it("then serializes classes, mangled variables and attributes in write order", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)

    effect.setClass(handle("hx-a"))
    effect.setVariable("someProp", "5")
    effect.setProperty("color", "red")
    effect.setAttribute("data-hx-1a2b", "")

    expect(renderElementAttributes(state)).toBe('class="hx-a" style="--hx-some-prop: 5; color: red" data-hx-1a2b=""')
  })

  it("then drops removed classes and variables symmetrically", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)

    effect.setClass(handle("hx-a"))
    effect.removeClass(handle("hx-a"))
    effect.setVariable("p", "1")
    effect.removeVariable("p")

    expect(renderElementAttributes(state)).toBe("")
  })
})

describe("renderThemeVariables", () => {
  it("then mangles token paths to the same --hx- custom properties the classes reference", () => {
    expect(renderThemeVariables(new Map([["Palette.Blue.t60", "#0f62fe"]]))).toBe("--hx-palette-blue-t60: #0f62fe")
  })
})

describe("SsrStyleDriver", () => {
  it("then composes the same class name and rule as the web platform (hydration parity)", () => {
    const driver = new SsrStyleDriver()
    const declarations = { color: "red" }
    const composed = driver.compose("Hover", [], declarations)

    const expected = hashClassName(`Hover ${JSON.stringify(declarations)}`)

    expect((composed as unknown as { className: string }).className).toBe(expected)
    expect(driver.css()).toBe(composeRule(expected, [], declarations))
  })
})

function render(): { css: string; attrs: string } {
  const driver = new SsrStyleDriver()

  managerWith(driver, { "A:size": 5 }).applyDefinition(cmp("A"), {
    name: "Box",
    dimension: {},
    rules: { "": { color: "red", width: "{size}px" } },
  })

  return { css: driver.css(), attrs: renderElementAttributes(driver.stateFor(cmp("A"))) }
}

describe("SSR styling through the core StyleManager", () => {
  it("then is deterministic across independent renders (hydration idempotence)", () => {
    expect(render()).toEqual(render())
  })

  it("then emits a content-hashed class and the {prop} value as an inline variable", () => {
    const { css, attrs } = render()

    expect(css).toContain("color: red")
    expect(css).toContain("width: calc(var(--hx-size) * 1px)")
    expect(attrs).toMatch(/^class="hx-[0-9a-z]+" style="--hx-size: 5"$/)
  })

  it("then emits scoped keyframes and rewrites animation references like the web", () => {
    const driver = new SsrStyleDriver()

    managerWith(driver).applyDefinition(cmp("B"), {
      name: "Button",
      dimension: {},
      rules: { "": { "animation-name": "pulse" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    })

    const css = driver.css()

    expect(css).toContain("@keyframes hx-Button-pulse")
    expect(css).toContain("animation-name: hx-Button-pulse")
  })
})
