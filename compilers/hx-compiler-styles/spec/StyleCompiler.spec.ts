import { StyleCompiler } from "@heleonix/hx-compiler-styles"

const compiler = new StyleCompiler()

async function rules(source: string): Promise<Record<string, Record<string, string>>> {
  return (await compiler.compile(source, {}, { name: "MyComponent" })).rules
}

describe("StyleCompiler", () => {
  describe("given the full README MyComponent.hxs example", () => {
    const source = `width: 8px;
box-shadow: 10px {someProp}px {$Colors.Roles.Primary.bg};

:hover { padding: {$Spacing.xs}; background-color: {$Colors.Roles.Primary.bgHovered}; }
:visited { background-color: red; }

@media (max-width: {$Breakpoints.mobile}) { width: 4px; }

@hx-if(value: {isInvalid}) { border-color: {$Colors.Border.danger}; }

@hx-if(value: {variant}, is: {'primary'}) { background-color: {$Colors.Roles.Primary.bg}; }

:hover { @media (max-width: 600px) { color: #123; } }

@hx-style(for: CustomSubCmpnt.Button) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}

@hx-style(for: some.descendant) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}

@hx-style(for: Component) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}`

    it("then compiles to the documented signature-keyed rules", async () => {
      expect(await rules(source)).toEqual({
        "": {
          width: "8px",
          "box-shadow": "10px {someProp}px {$Colors.Roles.Primary.bg}",
        },
        Hover: {
          padding: "{$Spacing.xs}",
          "background-color": "{$Colors.Roles.Primary.bgHovered}",
        },
        Visited: { "background-color": "red" },
        "Media(query:(max-width:{$Breakpoints.mobile}))": { width: "4px" },
        "If(value:{isInvalid})": { "border-color": "{$Colors.Border.danger}" },
        "If(is:{'primary'},value:{variant})": { "background-color": "{$Colors.Roles.Primary.bg}" },
        "Hover&Media(query:(max-width:600px))": { color: "#123" },
        "Style(for:CustomSubCmpnt.Button)": { "background-color": "{$Colors.Roles.Primary.bg}" },
        "Style(for:CustomSubCmpnt.Button)&Media(query:(max-width:600px))": { color: "#123" },
        "Style(for:some.descendant)": { "background-color": "{$Colors.Roles.Primary.bg}" },
        "Style(for:some.descendant)&Media(query:(max-width:600px))": { color: "#123" },
        "Style(for:Component)": { "background-color": "{$Colors.Roles.Primary.bg}" },
        "Style(for:Component)&Media(query:(max-width:600px))": { color: "#123" },
      })
    })
  })

  describe("given the multi-root nested-scope example", () => {
    const source = `color: {$Colors.Text.default};
font-family: {$Type.Body.family};

@hx-style(for: head) {
  position: sticky;
  @hx-style(for: menu.item) { padding: {$Spacing.xs}; }
}

@hx-style(for: body) {
  overflow: auto;
  @hx-style(for: Button.text) { font-size: {$Type.Body.size}; }
}`

    it("then resolves nested for-paths relative to the parent", async () => {
      expect(await rules(source)).toEqual({
        "": {
          color: "{$Colors.Text.default}",
          "font-family": "{$Type.Body.family}",
        },
        "Style(for:head)": { position: "sticky" },
        "Style(for:head.menu.item)": { padding: "{$Spacing.xs}" },
        "Style(for:body)": { overflow: "auto" },
        "Style(for:body.Button.text)": { "font-size": "{$Type.Body.size}" },
      })
    })
  })

  describe("given native media queries", () => {
    const source = `@media (max-width: {$Breakpoints.mobile}) and (orientation: landscape) { color: #123; }
@media print { display: none; }
@media (prefers-color-scheme: dark) { background-color: {$Colors.Bg.inverse}; }
@media (400px <= width <= 700px), print { font-size: 12px; }`

    it("then canonicalizes queries into Media signatures", async () => {
      expect(await rules(source)).toEqual({
        "Media(query:(max-width:{$Breakpoints.mobile}) and (orientation:landscape))": { color: "#123" },
        "Media(query:print)": { display: "none" },
        "Media(query:(prefers-color-scheme:dark))": { "background-color": "{$Colors.Bg.inverse}" },
        "Media(query:(400px <= width <= 700px),print)": { "font-size": "12px" },
      })
    })

    it("then sorts `and` operands alphabetically for a stable key", async () => {
      const compiled = await rules("@media (orientation: landscape) and (max-width: 600px) { color: red; }")

      expect(Object.keys(compiled)).toEqual(["Media(query:(max-width:600px) and (orientation:landscape))"])
    })
  })

  describe("given pseudo-classes and pseudo-elements", () => {
    const source = `:focus-within { outline: {$BorderWidths.medium} solid {$Colors.Border.focus}; }
:disabled { opacity: {$Opacity.disabled}; }
:nth-child(2n) { background-color: {$Colors.Bg.surfaceSunken}; }
::before { content: '*'; color: {$Colors.Roles.Primary.bg}; }
:hover { ::before { color: {$Colors.Roles.Primary.bgHovered}; } }`

    it("then maps to PascalCase signatures with the pseudo-element last", async () => {
      expect(await rules(source)).toEqual({
        FocusWithin: { outline: "{$BorderWidths.medium} solid {$Colors.Border.focus}" },
        Disabled: { opacity: "{$Opacity.disabled}" },
        "NthChild(2n)": { "background-color": "{$Colors.Bg.surfaceSunken}" },
        Before: { content: "'*'", color: "{$Colors.Roles.Primary.bg}" },
        "Hover&Before": { color: "{$Colors.Roles.Primary.bgHovered}" },
      })
    })
  })

  describe("given animations", () => {
    const source = `@keyframes pulse {
  from { transform: scale(1); }
  50%  { transform: scale({pulseScale}); }
  to   { transform: scale(1); }
}

@hx-if(value: {isSaving}) { animation: pulse {$Motion.slow} {$Motion.easeOut} infinite; }`

    it("then emits an @hx-if rule and a keyframes timeline", async () => {
      const definition = await compiler.compile(source, {}, { name: "MyComponent" })

      expect(definition.rules).toEqual({
        "If(value:{isSaving})": { animation: "pulse {$Motion.slow} {$Motion.easeOut} infinite" },
      })
      expect(definition.keyframes).toEqual({
        pulse: {
          from: { transform: "scale(1)" },
          "50%": { transform: "scale({pulseScale})" },
          to: { transform: "scale(1)" },
        },
      })
    })
  })

  describe("given a customer1 overlay with extend frontmatter", () => {
    const source = `---
usage: extend
---
:hover { padding: {$Spacing.sm}; }`

    it("then reads the usage and dimension", async () => {
      const definition = await compiler.compile(source, { customer: "customer1" }, { name: "MyComponent" })

      expect(definition).toEqual({
        name: "MyComponent",
        dimension: { customer: "customer1" },
        usage: "extend",
        rules: { Hover: { padding: "{$Spacing.sm}" } },
      })
    })
  })

  describe("given @hx-apply", () => {
    it("then records applied token paths per signature", async () => {
      const definition = await compiler.compile(
        "@hx-apply(token: Type.Body);\n:hover { @hx-apply(token: Type.Label); }",
        {},
        {},
      )

      expect(definition.applies).toEqual({ "": ["Type.Body"], Hover: ["Type.Label"] })
    })
  })

  describe("given a file-level doc comment", () => {
    it("then compileDocs returns the parsed summary", () => {
      const entry = compiler.compileDocs(
        "/** The component's chrome styles. */\nwidth: 8px;",
        {},
        { name: "MyComponent" },
      )

      expect(entry?.docs.summary).toBe("The component's chrome styles.")
    })
  })

  describe("given an unsupported at-rule", () => {
    it("then throws", async () => {
      await expectAsync(compiler.compile("@font-face { font-family: x; }", {}, {})).toBeRejectedWithError(/@font-face/)
    })
  })
})
