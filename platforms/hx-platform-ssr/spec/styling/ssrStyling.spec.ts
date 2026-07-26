import { StyleEngine, QualifierRegistry } from "@heleonix/hx-core"
import type { StyleHandle } from "@heleonix/hx-core"
import { composeRule, hashClassName } from "@heleonix/hx-platform-web"
import {
  SsrElementState,
  SsrStyleEffect,
  SsrStyleEnginePlatform,
  SsrStyleEngineState,
  renderElementAttributes,
  renderThemeVariables,
} from "@heleonix/hx-platform-ssr"

function handle(className: string): StyleHandle {
  return { className } as unknown as StyleHandle
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

describe("SsrStyleEnginePlatform", () => {
  it("then composes the same class name and rule as the web platform (hydration parity)", () => {
    const platform = new SsrStyleEnginePlatform<string>()
    const declarations = { color: "red" }
    const composed = platform.compose("Hover", [], declarations)

    const expected = hashClassName(`Hover ${JSON.stringify(declarations)}`)

    expect((composed as unknown as { className: string }).className).toBe(expected)
    expect(platform.css()).toBe(composeRule(expected, [], declarations))
  })
})

function render(): { css: string; attrs: string } {
  const platform = new SsrStyleEnginePlatform<string>()
  const state = new SsrStyleEngineState<string>((_component, prop) => (prop === "size" ? 5 : undefined))
  const engine = new StyleEngine<string>(new QualifierRegistry(), platform, state)

  engine.apply("A", { name: "Box", dimension: {}, rules: { "": { color: "red", width: "{size}px" } } })

  return { css: platform.css(), attrs: renderElementAttributes(platform.stateFor("A")) }
}

describe("SSR styling through the core StyleEngine", () => {
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
    const platform = new SsrStyleEnginePlatform<string>()
    const engine = new StyleEngine<string>(
      new QualifierRegistry(),
      platform,
      new SsrStyleEngineState<string>(() => undefined),
    )

    engine.apply("A", {
      name: "Button",
      dimension: {},
      rules: { "": { "animation-name": "pulse" } },
      keyframes: { pulse: { "50%": { transform: "scale(1.1)" } } },
    })

    const css = platform.css()

    expect(css).toContain("@keyframes hx-Button-pulse")
    expect(css).toContain("animation-name: hx-Button-pulse")
  })
})
