import { StyleManager } from "../../../../runtime/hx-core/src/styling/StyleManager"
import { BindingEvaluator, LiteralValueSource, MediaQualifier, StateValueSource } from "@heleonix/hx-core"
import type { Component, IQualifierProvider, IState, IValueSource, StyleHandle } from "@heleonix/hx-core"
import { composeClassName, composeRule, styleVariableName } from "@heleonix/hx-platform-web"
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

function managerWith(
  driver: SsrStyleDriver,
  values: Record<string, unknown> = {},
  sources: IValueSource[] = [],
): StyleManager {
  const state = stateWith(values)

  return new StyleManager(
    () => driver,
    { loadDefinition: () => Promise.resolve(undefined) } as never,
    { getTheme: () => Promise.resolve(undefined) } as never,
    state,
    new BindingEvaluator({ get: () => ({}) as never }, [
      new StateValueSource(state),
      new LiteralValueSource(),
      ...sources,
    ]),
    NO_QUALIFIERS,
  )
}

describe("SsrStyleEffect + renderElementAttributes", () => {
  it("then serializes classes, mangled variables and attributes in write order", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)

    effect.setClass(handle("hx-a"))
    effect.setVariable({ source: "someProp", text: false }, "5")
    effect.setProperty("color", "red")
    effect.setAttribute("data-hx-1a2b", "")

    expect(renderElementAttributes(state)).toBe('class="hx-a" style="--hx-some-prop: 5; color: red" data-hx-1a2b=""')
  })

  it("then drops removed classes and variables symmetrically", () => {
    const state = new SsrElementState()
    const effect = new SsrStyleEffect(state)

    effect.setClass(handle("hx-a"))
    effect.removeClass(handle("hx-a"))
    effect.setVariable({ source: "p", text: false }, "1")
    effect.removeVariable({ source: "p", text: false })

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

    const expected = composeClassName("Hover", [], declarations)

    expect((composed as unknown as { className: string }).className).toBe(expected)
    expect(driver.css()).toBe(composeRule(expected, [], declarations))
  })
})

async function render(): Promise<{ css: string; attrs: string }> {
  const driver = new SsrStyleDriver()

  await managerWith(driver, { "A:size": 5 }).applyDefinition(cmp("A"), {
    name: "Box",
    dimension: {},
    rules: { "": { color: "red", width: "{size}px" } },
  })

  return { css: driver.css(), attrs: renderElementAttributes(driver.stateFor(cmp("A"))) }
}

describe("SSR styling through the core StyleManager", () => {
  it("then is deterministic across independent renders (hydration idempotence)", async () => {
    expect(await render()).toEqual(await render())
  })

  it("then emits a content-hashed class and the {prop} value as an inline variable", async () => {
    const { css, attrs } = await render()

    expect(css).toContain("color: red")
    expect(css).toContain("width: calc(var(--hx-size) * 1px)")
    expect(attrs).toMatch(/^class="hx-[0-9a-z]+" style="--hx-size: 5"$/)
  })

  it("then emits scoped keyframes and rewrites animation references like the web", async () => {
    const driver = new SsrStyleDriver()

    await managerWith(driver).applyDefinition(cmp("B"), {
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

describe("SSR dictionary and config values in declarations", () => {
  const labels: IValueSource = {
    type: "dictionary",
    get: (path: string) => Promise.resolve(path === "Labels.title" ? 'Say "hi" <b>' : undefined),
  }
  const layout: IValueSource = {
    type: "config",
    get: (path: string) => Promise.resolve(path === "Layout.gap" ? "8" : undefined),
  }

  it("then renders a quoted dictionary entry as an escaped text variable and a config entry as a raw one", async () => {
    const driver = new SsrStyleDriver()

    await managerWith(driver, {}, [labels, layout]).applyDefinition(cmp("C"), {
      name: "Card",
      dimension: {},
      rules: { "": { content: "'{@Labels.title}'", gap: "{#Layout.gap}px" } },
    })

    const text = styleVariableName({ source: "@Labels.title", text: true })
    const raw = styleVariableName({ source: "#Layout.gap", text: false })

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

describe("SSR theme tokens in media queries", () => {
  it("then emits the query with the theme value resolved, never a CSS variable", async () => {
    const driver = new SsrStyleDriver()
    const state = stateWith({})
    const manager = new StyleManager(
      () => driver,
      { loadDefinition: () => Promise.resolve(undefined) } as never,
      {
        getTheme: () => Promise.resolve({ name: "", dimension: {}, groups: { Breakpoints: { mobile: "600px" } } }),
      } as never,
      state,
      new BindingEvaluator({ get: () => ({}) as never }, [new StateValueSource(state), new LiteralValueSource()]),
      { get: (name: string) => (name === "Media" ? new MediaQualifier() : undefined) },
    )

    await manager.applyDefinition(cmp("M"), {
      name: "Card",
      dimension: {},
      rules: { "Media(query:(max-width:{$Breakpoints.mobile}))": { color: "red" } },
    })

    expect(driver.css()).toContain("@media (max-width:600px) {")
    expect(driver.css()).not.toContain("var(")
  })
})

describe("SSR component properties in media queries", () => {
  async function renderWith(maxWidth: unknown): Promise<string> {
    const driver = new SsrStyleDriver()
    const state = stateWith({ "M:maxWidth": maxWidth })
    const manager = new StyleManager(
      () => driver,
      { loadDefinition: () => Promise.resolve(undefined) } as never,
      { getTheme: () => Promise.resolve(undefined) } as never,
      state,
      new BindingEvaluator({ get: () => ({}) as never }, [new StateValueSource(state), new LiteralValueSource()]),
      { get: (name: string) => (name === "Media" ? new MediaQualifier() : undefined) },
    )

    await manager.applyDefinition(cmp("M"), {
      name: "Card",
      dimension: {},
      rules: { "Media(query:(max-width:{maxWidth}px))": { color: "red" } },
    })

    return driver.css()
  }

  it("then renders the instance's property value into the query", async () => {
    expect(await renderWith(600)).toContain("@media (max-width:600px) {")
  })

  it("then disables the rule rather than let a property value escape into the stylesheet", async () => {
    const css = await renderWith("1px) { } body { background: red")

    expect(css).toContain("@media not all {")
    expect(css).not.toContain("body {")
  })
})
