# Heleonix

Flexible declarative framework for web sites and web applications.

## Install

TBD

## TODO

### IMPLEMENT

    - @heleonix/testing wrapped mocks, auto deep mocks, auto shallow mocks, manual mocks
        ○ @heleonix/testing-jasmine
        ○ @heleonix/testing-jest
    - Store full path to each view being rendered in the presenter and pass it to an exception if any
    - Review all implementation and implement validation functions which throw exceptions for all components and all cases
    - Use Object.is to compare values in setters of data, property, state decorators

### DIMENSION

Dimension is an object with string values, which splits resources of applications:

```json
{
  "env": "dev",
  "customer": "customer1",
  "culture": "uk-UK"
}
```

In webpack plugins dimensions are specified as below:

```javascript
;[
  {
    name: "customer",
    values: ["customer1", "customer2", "customer3"],
  },
  {
    name: "culture",
    values: ["en-US", "uk-UK"],
  },
  {
    name: "env",
    values: ["dev", "test", "prod"],
  },
]
```

Dimension-specific files are named in format:

MyFile.ext
MyFile.uk-UK.customer1.dev.ext
MyFile.uk-UK.ext
MyFile.dev.ext
MyFile.customer1.ext

### MERGEABLE

Mergeable resources for more specific dimensions can just override or add less specific dimensions to avoid full re-definitions and duplicates.

Mergeable are:

- dictionaries
- configs
- themes
- styles

### DICTIONARIES (Mergeable): \*.hxd

Mergeable means dictionaries for more specific dimensions can just override or add less specific dimensions to avoid
full re-definitions and duplicates.

Buttons.en-US.hxd
Buttons.en-US.customer1.hxd
Buttons.en-GB.customer1.hxd

Buttons.en-US.customer2.hxd:

```jsonc
---
usage: override
---
{
  "Add": "Add",
  "Remove": "Remove",
  // comments
  "Ok": "Ok {usertitle}",
  /*
  comments
  here
  */
  "OkOrCancel": "Hi {username}! Are you {@Ok} or {@BaseControls.Cancel}?"
}
```

Compiled into:

```json
{
  "name": "Buttons",
  "dimension": {
    "culture": "en-US",
    "customer": "customer2"
  },
  "usage": "override",
  "items": {
    "Add": "Add",
    "Remove": "Remove",
    "Ok": "OK {usertitle}",
    "OkOrCancel": "Hi {username}! Are you {@Ok} or {@BaseControls.Cancel}?"
  }
}
```

Buttons.en-US.customer2.test.hxd

```jsonc
---
usage: extend
---
{
  "Add": "Add Test"
}
```

Compiled into:

```json
{
  "name": "Buttons",
  "dimension": {
    "culture": "en-US",
    "customer": "customer2",
    "env": "test"
  },
  "usage": "extend",
  "items": {
    "Add": "Add Test"
  }
}
```

### CONFIGS (Mergeable): \*.hxc

```jsonc
---
usage: extend
---
{
  "Cfg1": 111,
  // comments
  /*
  comments
  */
  "Array": [1, 2, 3]
}
```

### METADATA: hx.meta.json

Each package ships **one** compiled metadata manifest under the `hxmeta` export condition — the compile-time channel
consumed by build validation, editors and docs generation. It is never a runtime payload, and there are no per-file
sidecars: metadata's consumers always need the whole package index, and one artifact cannot drift against itself.

```jsonc
{
  "schemaVersion": 1,
  "package": "@acme/ui",
  "version": "1.0.0",
  // doc comments of every kind, joined to definitions by kind + name + dimension
  "docs": [{ "kind": "component", "name": "Greeting", "dimension": {}, "docs": { "summary": "..." } }],
  // component contracts: props/events resolved to member facts (see below), per dimension file.
  // `open` marks a component that also accepts attributes beyond its enumerated set (native elements).
  "components": [
    {
      "name": "Greeting",
      "dimension": {},
      "docs": "* Greets the current user.",
      "props": [
        {
          "name": "variant",
          "optional": true,
          "kind": "enum",
          "enumValues": ["primary", "default"],
          "isFunction": false,
        },
      ],
    },
  ],
  // converter/action contracts from discovered TypeScript classes: name + resolved params
  "converters": [
    { "name": "Truncate", "params": [{ "name": "length", "optional": false, "kind": "number", "isFunction": false }] },
  ],
  "actions": [
    { "name": "Submit", "params": [{ "name": "id", "optional": false, "kind": "number", "isFunction": false }] },
  ],
}
```

- Every section is optional; consumers read the facets they understand. `schemaVersion` is first so consumers can
  detect incompatible manifests.
- **Member facts** (`props`/`events`/`params` entries) are resolved from the TypeScript types at the _producing_
  package's build time — `{ name, optional, kind, enumValues?, isFunction, readonly?, docs? }` where `kind` is one of
  `string | number | boolean | enum | object | array | unknown`. Shipping resolved facts (not raw type text) lets a
  consuming package validate usages without re-resolving the library's TypeScript sources.
- Authority is per-facet: contracts validate at error grade, docs never affect compilation — stripping any facet only
  degrades tooling, never behavior.
- Emitted by the build plugin (`emitMeta: true` -> `hx.meta.json` in `output.path`); sections are sorted so the
  artifact doesn't churn with scan order.

Shared, reusable prop/param types are ordinary **TypeScript** types in `.ts` modules (enums, string-literal unions,
interfaces), referenced from a component/converter/action — there is no separate DSL type format. See _Typings
frontmatter_ under COMPONENTS and the CONVERTERS/ACTIONS sections.

### STYLES (Mergeable): \*.hxs

Style is applied as class="auto generated classes" to the root native html elements only, i.e.:

```xml
<div class="auto generated classes">
	<button />
	<button />
	<button />
</div>
```

OR

```xml
<li class="auto generated classes">one</li>
<li class="auto generated classes">two</li>
<li class="auto generated classes">three</li>
```

`*.hxs` uses a **custom CSS-subset syntax** (not XML), parsed by a dependency-free grammar shared with `*.hxt`. A
`{...}` interpolation is a **binding source** — the same grammar as a `*.hxm` braced attribute value, plus theme tokens:
`{someProp}` (a component property / state path), `{@Dictionary.key}` (a dictionary reference), `{#Config.path}` (a
config reference) and `{$Theme.token}` (a theme token). Both **CSS declaration values and qualifier arguments** use it.
When a bound source changes — a property, or a dictionary/config/theme under a culture/dimension switch — the style
re-renders automatically.

Syntax rules:

- **Declarations are CSS**: `padding: {$Spacing.xs};`. Values are raw CSS text with optional `{...}` binding-source
  interpolations — `{prop}` (state), `{@Dict.key}` (dictionary), `{#Config.path}` (config), `{$Theme.token}` (theme);
  the surrounding text is literal.
- **Native CSS spelling for what CSS already has**: pseudo-classes/elements (`:hover`, `::before`), media
  (`@media (...)`), keyframes (`@keyframes`). They are recognized and compiled to platform-neutral signatures.
- **`@hx-*(named: args)` blocks for framework qualifiers** - concepts CSS has no syntax for: `@hx-if` (property
  conditions), `@hx-style` (component-scoped rules), and custom ones like `@hx-on-raising`. The `@hx-` namespace never
  collides with a current or future CSS at-rule.
- A block is introduced by a pseudo (`:hover`) or an at-rule (`@media (...)`, `@hx-*(...)`); after an identifier `:`
  begins a declaration and `{` begins a block, so the two never clash.
- Nesting means AND: `:hover { @media (...) { ... } }` applies on hover AND matching media.
- `@hx-if(value: {subject})` applies its declarations while the subject is truthy. The subject is the `value:` argument — a `{...}` binding source, with `*.hxm` addressing
  (`{sub.subsub:isInvalid}`) — the same argument name as the `<If value={...}>` / `<Switch value={...}>` builtins in
  \*.hxm, so the condition grammar is identical across both formats. Comparison arguments test it against an operand:
  `@hx-if(value: {variant}, is: {'primary'})`, `@hx-if(value: {variant}, isNot: {'danger'})`. Operands are one value
  expression each: a literal (`3`, `true`, a string literal `'primary'` checked against the subject's enum, raw CSS
  text — equality is strict lexical/numeric, never unit-aware, so `12px` != `1em`), or any `{...}` binding source —
  `{other.prop}` (another property, for selected-item/active-state styling), `{@Dict.key}`, `{#Config.path}` or
  `{$Theme.token}` (the rule re-evaluates when the bound dictionary/config/theme changes). A **boolean** operand is the
  one that does not compare strictly: it tests the subject's truthiness, so `is: {true}` is the bare condition spelled
  out and `is: {false}` / `isNot: {true}` is its negation, for a subject of any type. (Strict equality against a
  boolean would be dead for every non-boolean subject, so nothing is given up.) That is the whole of negation — there is
  no separate negated qualifier. One subject per qualifier; multiple conditions nest (nesting means AND). No operators or
  expressions inside braces — anything more is computed state authored in \*.hxm. On web the runtime toggles a `data-`
  attribute on the root element, selected via `[data-...]` - no class regeneration.
- `@hx-style(for: path)` scopes declarations to child components, with the same name resolution as in \*.hxm. Each path
  segment steps one definition level and is either a control name (a specific instance) or a component type (every
  instance assignable to that type - is-a matching, so a type also covers components derived from it), so instances and
  types mix freely: `for: add` targets the child named `add`, `for: CustomSubCmpnt.Button` targets all Buttons inside
  the sub-component, `for: some.descendant.Button.text` targets the `text` component inside every Button inside the
  `descendant` inside `some`. A control named the same as a component type at the same level is an error, as in \*.hxm.
  There is no wildcard token: since every component is-a `Component`, the base type is the wildcard -
  `@hx-style(for: Component)` targets all first-level child components, and mid-path `for: some.Component.text` targets
  the `text` inside every child of `some`. Scopes always target component boundaries, never raw DOM
  inside a child.
- `Children` (the content-projection component) is an ordinary type segment too. `for: Children` targets the components
  projected into this component at its usage site - for `<MyCmpnt><div /><span /><SomeCmpnt /></MyCmpnt>` the `div`,
  `span` and `SomeCmpnt` receive the classes: the slot renders no element of its own, so per the component-boundary
  rule the styling lands on the projected children's roots. `for: sub.Children` targets the content projected into the
  `sub` component, and further segments resolve within that projected content, like after any other segment:
  `for: sub.Children.subsub` targets the component named `subsub` among the children passed to `sub`. Merge usage is file-level only (frontmatter): scoped groups always merge per-declaration across
  dimensions; use CSS reset values (`none`, `unset`, `initial`) to drop inherited declarations.
- Comments are `/* block */` and `// line` (part of the grammar shared with \*.hxt). Inside quoted strings and balanced
  parens they are value text, not comments - `url(https://...)` and `content: '/*'` are safe.
- No core qualifier handles events: events are handled in \*.hxm and update properties; styles react to properties via
  `@hx-if` and `{prop}` bindings, so a style stays a pure function of state and merges cleanly across dimensions.
  Event-driven styling is possible as an opt-in custom qualifier like `@hx-on-raising` (see Style qualifiers below).
- Since CSS cannot concatenate `var()` with a unit, `{someProp}px` compiles to `calc(var(--hx-some-prop) * 1px)`.

Multiple roots (when a component definition has several root elements or components):

- `for` paths resolve against the component's own definition, and roots are part of it: `@hx-style(for: header)`
  targets the root named `header` itself - it never searches inside each root. Reaching inside a root is an explicit
  path (`header.menu`), like any other scope path.
- Bare top-level declarations (outside any `@hx-style`) apply to every root - this is where common styles live. `{prop}`
  CSS variables and `@hx-if` `data-*` attributes are likewise set on every root, so conditions and bindings behave
  identically on each root.
- Bind a whole block to one root with `@hx-style(for: header) { ... }`; `for` paths nested inside resolve relative to it
  (`@hx-style(for: menu.item)` inside targets `header.menu.item`). A root name that does not exist in the \*.hxm is a
  compile error.
- A root that is itself a component receives the classes on its own root elements, recursively, per the
  component-boundary rule. `@hx-style(for: Component)` includes component roots: they are the first-level child components of
  the definition.
- There is no implicit wrapper box around multiple roots: a declaration like `display: flex` applies to each root
  individually, not around them. When a single box is needed, add a wrapper root element in the \*.hxm.

```xml
<!-- MyComponent.hxm -->
<Component>
    <header name="head">...</header>
    <section name="body">...</section>
</Component>
```

MyComponent.hxs:

```css
color: {$Colors.Text.default};
font-family: {$Type.Body.family};

@hx-style(for: head) {
  position: sticky;
  @hx-style(for: menu.item) { padding: {$Spacing.xs}; }
}

@hx-style(for: body) {
  overflow: auto;
  /* 'text' component inside every Button inside the 'body' root */
  @hx-style(for: Button.text) { font-size: {$Type.Body.size}; }
}
```

Compiled into (a nested `@hx-style` `for` path resolves relative to its parent, so `menu.item` inside `for: head`
becomes `head.menu.item`):

```json
{
  "rules": {
    "": {
      "color": "{$Colors.Text.default}",
      "font-family": "{$Type.Body.family}"
    },
    "Style(for:head)": { "position": "sticky" },
    "Style(for:head.menu.item)": { "padding": "{$Spacing.xs}" },
    "Style(for:body)": { "overflow": "auto" },
    "Style(for:body.Button.text)": { "font-size": "{$Type.Body.size}" }
  }
}
```

Media queries use native CSS `@media`:

- The prelude is a raw CSS media query: media types (`print`), features (`(orientation: landscape)`), `and`, `,` lists
  (OR), `not`, `only`, and range syntax like `(400px <= width <= 700px)`. The compiler captures it as the `query`
  argument of the neutral `Media` signature.
- `{$Theme.token}` interpolations are allowed inside the query; breakpoints are referenced explicitly:
  `@media (max-width: {$Breakpoints.mobile})`.
- Nesting `@media` inside other blocks (or another `@media`) combines with `and`.

```css
@media (max-width: {$Breakpoints.mobile}) and (orientation: landscape) { color: #123; }
@media print { display: none; }
@media (prefers-color-scheme: dark) { background-color: {$Colors.Bg.inverse}; }
@media (400px <= width <= 700px), print { font-size: 12px; }
```

Compiled into (queries are canonicalized - whitespace normalized, `and` operands sorted alphabetically - so the same
query always produces the same rule key and dimension overlays merge correctly):

```json
{
  "rules": {
    "Media(query:(max-width:{$Breakpoints.mobile}) and (orientation:landscape))": { "color": "#123" },
    "Media(query:print)": { "display": "none" },
    "Media(query:(prefers-color-scheme:dark))": { "background-color": "{$Colors.Bg.inverse}" },
    "Media(query:(400px <= width <= 700px),print)": { "font-size": "12px" }
  }
}
```

Pseudo-classes and pseudo-elements use native CSS spelling (all of CSS is available):

- `:hover`, `:focus-within`, `:placeholder-shown`, `:checked`, `::before`, `::placeholder`, `::selection`, ... are
  recognized against the same CSS dataset used to validate declaration names and compiled to PascalCase signatures
  (`:hover` -> `Hover`, `::before` -> `Before`). Two data-driven qualifiers - `PseudoClassQualifier` and
  `PseudoElementQualifier` - cover all of them, so new pseudos arriving in CSS are a dataset update, not new code.
- Functional pseudos keep CSS's positional argument: `:nth-child(2n+1)` -> `NthChild(2n+1)`, `:lang(en)`, `:dir(rtl)`,
  `:not(:hover)`. The argument is passed through as written.
- Pseudo-elements are sub-targets, not conditions: at most one per rule (a compile error otherwise), and always
  serialized last in the rule key regardless of nesting order - `:hover { ::before { ... } }` compiles to `Hover&Before`
  (`:hover::before` on web).
- Like all selector qualifiers, pseudos resolve to plain CSS on web with zero runtime cost; other platforms map the
  subset they support and report the rest as unsupported.

```css
:focus-within { outline: {$BorderWidths.medium} solid {$Colors.Border.focus}; }
:disabled { opacity: {$Opacity.disabled}; }
:nth-child(2n) { background-color: {$Colors.Bg.surfaceSunken}; }
::before { content: '*'; color: {$Colors.Roles.Primary.bg}; }
:hover { ::before { color: {$Colors.Roles.Primary.bgHovered}; } }
```

Compiled into:

```json
{
  "rules": {
    "FocusWithin": { "outline": "{$BorderWidths.medium} solid {$Colors.Border.focus}" },
    "Disabled": { "opacity": "{$Opacity.disabled}" },
    "NthChild(2n)": { "background-color": "{$Colors.Bg.surfaceSunken}" },
    "Before": { "content": "'*'", "color": "{$Colors.Roles.Primary.bg}" },
    "Hover&Before": { "color": "{$Colors.Roles.Primary.bgHovered}" }
  }
}
```

Animations:

- Transitions need no special syntax - `transition` is a regular declaration:
  `transition: background-color {$Motion.fast} {$Motion.easeOut};`.
- Keyframes use native CSS `@keyframes`; frame selectors are `from`/`to`/percentages (`50%`, or multiple stops
  `20%, 80%`), and frame declarations carry the same `{prop}` / `{$Theme.token}` bindings as anywhere else.
- A timeline is referenced by name from the regular `animation` / `animation-name` declaration:
  `animation: pulse {$Motion.slow} infinite;`. Names resolve against component-local timelines first, then the merged
  theme's shared timelines (see THEMES: `@keyframes` in \*.hxt) - a local timeline shadows a theme timeline of the same
  name. Compiled names are scoped (`hx-MyComponent-pulse` for local, app-scoped for theme timelines) and references are
  rewritten, so names cannot clash across components.
- State-triggered animations are just `@hx-if` + `animation`: the animation runs while the property is truthy.
  Keyframes merge across dimension overlays per frame, like rules.

```css
@keyframes pulse {
  from { transform: scale(1); }
  50%  { transform: scale({pulseScale}); }
  to   { transform: scale(1); }
}

@hx-if(value: {isSaving}) { animation: pulse {$Motion.slow} {$Motion.easeOut} infinite; }
```

Compiled into:

```json
{
  "rules": {
    "If(value:{isSaving})": { "animation": "pulse {$Motion.slow} {$Motion.easeOut} infinite" }
  },
  "keyframes": {
    "pulse": {
      "from": { "transform": "scale(1)" },
      "50%": { "transform": "scale({pulseScale})" },
      "to": { "transform": "scale(1)" }
    }
  }
}
```

Reusable styling (shared through the theme - see also THEMES for `@keyframes` / `@font-face` / `@counter-style`):

- `@hx-apply(token: Type.Body);` expands a theme group as declarations. The group's leaf names are read as CSS property
  names _at the apply site_ (the theme itself stays semantics-free), so groups meant for applying use CSS property
  names as leaf names: `Type { Body { font-family: {$FontFamilies.sans}; font-size: {$FontSizes.md}; } }` - a leaf name
  that is not a valid CSS property is a compile/LSP error at the apply site. Values ride the usual `var()` chains, and
  expansion happens at class-generation time against the merged theme, so a dimension overlay that changes or adds
  group entries is fully honored.
- Conflicts follow document order: a later explicit declaration overrides an applied one, and applying two groups with
  overlapping keys - the later application wins. `@hx-apply` may appear at top level and inside any block.
- Named media conditions are plain tokens holding query text (theme interpolation in queries already allows this):
  `Media { compact: (max-width: {$Breakpoints.mobile}) and (orientation: portrait); }` used as
  `@media {$Media.compact} { ... }` - consistent responsive behavior across components with no extra syntax.
- There are deliberately **no cross-component style includes**, no mixins carrying selectors/conditions, and no utility
  classes: shared values are theme tokens, shared declaration groups are `@hx-apply`, shared named CSS artifacts are
  theme `@`-blocks, shared visual patterns are components.
- Global element selectors (resets, universal `box-sizing`, body defaults) are intentionally inexpressible - a scoped
  rule can never leak across a component boundary. The outlets: the application root component's own \*.hxs
  (inheritable properties like font and color cascade down naturally), `@hx-style(for: Component)` for direct children,
  and the web platform's documented base sheet for true universals.

Style qualifiers:

Every conditioning construct is interpreted by a qualifier. Native CSS spellings (`:hover`, `::before`, `@media`,
`@keyframes`) are built-in qualifiers; framework concepts are `@hx-*(named: args)` blocks. A qualifier is a class
provided through `IApplicationBootstrap.qualifiers` at runtime only, like other framework elements - its rule-key
segment name is the class name minus the required `Qualifier` suffix, and a custom class of a built-in name replaces
that built-in. Neither the compiler nor the build has a qualifier code API, and the style system hardcodes no
conditions. One qualifier can claim many spellings (the pseudo families each claim hundreds).

- Signatures are mechanical, produced by the compiler without qualifier code: each construct serializes to one segment
  - `Name` with no arguments, `Name(name:value,...)` for named args (sorted, comma-joined), or `Name(value,...)` for
    the positional args of native functional pseudos - and nesting (AND) joins segments with `&`. `:hover` -> `Hover`,
    `@media (...)` -> `Media(query:...)`, `@hx-if(value: {variant}, is: {'primary'})` -> `If(is:{'primary'},value:{variant})`, `@hx-style(for: x.y)` ->
    `Style(for:x.y)`, `@hx-style(for: Component)` -> `Style(for:Component)`. Rule keys are the merge identity across dimension files,
    platform-neutral and free of CSS syntax.
- Values are opaque and may contain `:` `,` `/` `()` (a media query is `Media(query:(400px <= width <= 700px),print)`,
  an aspect ratio is `16/9`), so keys are read paren-depth-aware: only a top-level `&` separates segments (`&` never
  occurs in canonical CSS value text, unlike `/`), only a
  top-level `,` separates a segment's arguments, and the first `:` of each named argument splits its name from the
  value - anything inside balanced parens is value text.
- `@hx-*` arguments are named-only, so each maps 1:1 to a typed parameter and canonicalizes by sorting on name — the
  condition qualifiers' subject is the ordinary named argument `value:`, same as the `<If value={...}>` builtin in
  \*.hxm. Positional arguments exist only in native functional pseudos (`:nth-child(2n+1)`), which are CSS, not
  `@hx-*`. There are no reserved arguments: every argument of every qualifier is signature material. Merge `usage`
  exists only in file frontmatter, like the other mergeable formats.
- Canonicalization that affects merge identity stays in the compiler as built-in normalizers driven by metadata flags
  (e.g. media query normalization) - not qualifier code.
- Tooling comes from the qualifier's TypeScript surface, split by concern:
  - **Syntax highlighting** is grammar-driven and generic: the TextMate/semantic-token grammar tokenizes CSS
    declarations, pseudo selectors and any `@hx-word(args) { }` block, so new qualifiers need no grammar change.
  - **Completion, hover, signature-help and validation** come from the qualifier's `.d.ts` + JSDoc. Its parameters and
    docs drive arg-name completion and hover text; **branded argument types route each arg to the right existing
    provider** - `PropertyRef`/`EventRef` reuse the component-state/event path completion (which already understands
    `ctrl.path:prop` addressing), `ThemeTokenRef` reuses the `{$...}` completion, and string-literal unions (e.g. a
    custom qualifier's `mode?: "in" | "out"`) give free enum completion. Without a `.d.ts` a custom `@hx-*` still
    compiles mechanically, but typos surface at runtime instead of in the editor.
  - The LSP reads these types the way it already reads `hx-compiler-core` - via built dist types / a generated
    manifest; live TS resolution over the project is an optional upgrade.
- Qualifiers provide behavior in one of two kinds:
  - Selector qualifiers return the platform's static mapping: on web `Hover` -> `:hover`, `Media(query:...)` ->
    `@media (...)`; another platform maps the same signatures to its own state/viewport mechanisms.
  - Runtime qualifiers attach per component instance: they receive the component, the compiled rule group and an
    apply/remove API (toggle the generated class or a `data-*` attribute, set CSS variables). `@hx-if` is one: it
    subscribes to its properties (and to the theme when a `{$...}` operand is used) and toggles `data-*` attributes.
- There is one code path: the definition -> styling generator is a pure isomorphic function over the registered
  qualifiers. It runs at app startup on the client, on the server for SSR, and in Node during build for static CSS
  extraction - "build-time CSS" is the same runtime generator executed early, not a second qualifier API.

Built-in qualifiers ship registered by default: `PseudoClassQualifier` and `PseudoElementQualifier` (every CSS
pseudo-class/element), `MediaQualifier` (`@media`), `ConditionQualifier` (`@hx-if`), and `ScopeQualifier`
(`@hx-style`). Not every construct is a qualifier: `@keyframes` emits a named `keyframes` timeline, and the
`@hx-apply(token: ...);` statement expands declarations at class-generation time - neither produces a rule-key
segment. A custom qualifier is a runtime class plus its `.d.ts`; e.g. an
`@hx-on-raising(event: ...)` qualifier that applies a rule group when an event fires is an opt-in - the core stays a
pure function of state, but the mechanism does not forbid event-driven styling where a consumer accepts the trade-offs.

MyComponent.hxs
MyComponent.customer1.hxs
MyComponent.en-US.customer1.hxs

MyComponent.hxs:

```css
width: 8px;
box-shadow: 10px {someProp}px {$Colors.Roles.Primary.bg};

:hover { padding: {$Spacing.xs}; background-color: {$Colors.Roles.Primary.bgHovered}; }
:visited { background-color: red; }

@media (max-width: {$Breakpoints.mobile}) { width: 4px; }

@hx-if(value: {isInvalid}) { border-color: {$Colors.Border.danger}; }

@hx-if(value: {variant}, is: {'primary'}) { background-color: {$Colors.Roles.Primary.bg}; }

:hover { @media (max-width: 600px) { color: #123; } }

/* all child buttons in this component */
@hx-style(for: CustomSubCmpnt.Button) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}

/* 'descendant' component inside 'some' inside this component */
@hx-style(for: some.descendant) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}

/* all first-level child components */
@hx-style(for: Component) {
  background-color: {$Colors.Roles.Primary.bg};
  @media (max-width: 600px) { color: #123; }
}
```

Compiled into rules keyed by a canonical qualifier signature (`""` root, `Hover`, `Media(query:...)`,
`If(value:{property})` / `If(is:{'member'},value:{property})`, `Style(for:component.path)` scope, `Style(for:Component)` all first-level children,
joined with `&` for AND; no CSS syntax in definitions), so dimension overlays merge per-declaration with the same
deep-merge as dictionaries and configs:

```json
{
  "name": "MyComponent",
  "dimension": {},
  "usage": "override",
  "rules": {
    "": {
      "width": "8px",
      "box-shadow": "10px {someProp}px {$Colors.Roles.Primary.bg}"
    },
    "Hover": {
      "padding": "{$Spacing.xs}",
      "background-color": "{$Colors.Roles.Primary.bgHovered}"
    },
    "Visited": { "background-color": "red" },
    "Media(query:(max-width:{$Breakpoints.mobile}))": { "width": "4px" },
    "If(value:{isInvalid})": { "border-color": "{$Colors.Border.danger}" },
    "Hover&Media(query:(max-width:600px))": { "color": "#123" },
    "Style(for:CustomSubCmpnt.Button)": { "background-color": "{$Colors.Roles.Primary.bg}" },
    "Style(for:CustomSubCmpnt.Button)&Media(query:(max-width:600px))": { "color": "#123" },
    "Style(for:some.descendant)": { "background-color": "{$Colors.Roles.Primary.bg}" },
    "Style(for:some.descendant)&Media(query:(max-width:600px))": { "color": "#123" },
    "Style(for:Component)": { "background-color": "{$Colors.Roles.Primary.bg}" },
    "Style(for:Component)&Media(query:(max-width:600px))": { "color": "#123" }
  }
}
```

MyComponent.customer1.hxs:

```css
---
usage: extend
---
:hover { padding: {$Spacing.sm}; }
```

Compiled into:

```json
{
  "name": "MyComponent",
  "dimension": { "customer": "customer1" },
  "usage": "extend",
  "rules": {
    "Hover": { "padding": "{$Spacing.sm}" }
  }
}
```

Codegen/runtime:

- The compiled definition is platform-neutral data: rule keys are qualifier signatures, declarations are name/value
  pairs, and no CSS text, selectors or vendor prefixes appear in it. Declarations use the CSS property vocabulary as
  the common language: web maps it 1:1, another platform maps the subset it implements and reports unsupported
  declarations. Turning definitions into actual styling (CSS classes, native style objects) is platform codegen in
  `platforms/*`.
- On web, static values and `{$theme}` references become static CSS classes generated once. Themes publish
  `--hx-theme-*` CSS variables, so switching a theme or dimension is a variable swap with zero per-component work.
- `{prop}` references become `var(--hx-<prop>)` set via `style.setProperty` on each of the component's root elements
  when the property changes - per-instance, no class regeneration.
- `@hx-if` conditions toggle `data-*` attributes on every root element.
- Scoped rules (`Style(for:path)`, `Style(for:Component)`) are resolved through the component tree, not through CSS
  descendant/child combinators: each scope group compiles to its own class, and the runtime applies that class to the
  root native elements of the matched child components (to every root, when a component renders multiple root elements,
  like the `<li>` example above). `Style(for:Component)` matches direct child components regardless of how deep their root
  elements sit in
  this component's own DOM. Since no combinator selectors are generated, a scoped rule can never leak into a child
  component's internal DOM.
- Browser-specific prefixing belongs to web codegen, not to definitions: the web platform emits vendor-prefixed
  declarations (`-webkit-`, `-moz-`, `-ms-`) next to the standard one where needed, driven by a built-in prefix table
  (generated at build time of the package itself, since framework packages are dependency-free). Prefixing happens
  when CSS is generated - never per-update at runtime and never in the compiled definition.
- SSR: generated class names are deterministic (derived from component name + dimension + rule signature), so the
  server and the client produce byte-identical CSS and class attributes, and hydration only attaches subscriptions -
  no style recomputation, no DOM writes. Initial `@hx-if` states render as `data-*` attributes and `{prop}` values as
  inline CSS variables directly in the HTML. Selector qualifiers are pure functions and SSR-safe by construction;
  runtime qualifiers must derive their initial state from properties alone - one more reason core qualifiers stay
  state-pure.
- Sanitization: declaration names are validated at compile time against the known CSS property list, and static values
  are validated to be well-formed CSS values (unbalanced quotes/parens, `;`, `}` and rule/at-rule injection are
  compile errors). Property-bound values are sanitized by the runtime before `style.setProperty`: values that could
  escape the declaration or inject behavior (`;`, `}`, `!important`, `url(`, `expression(`) are rejected and the
  declaration falls back to its static/theme value, so user data flowing into `{prop}` bindings cannot inject CSS.

### THEMES (Mergeable): \*.hxt

A theme is a tree of design tokens with **arbitrary, consumer-defined structure**: any groups, nesting and token names.
The framework attaches no semantics to any name - different consumers invent their own design systems. `*.hxt` uses the
same **block-style CSS-subset syntax** as `*.hxs` (shared parser); only the format is fixed:

- **Blocks are groups, `name: value;` declarations are tokens.** Multi-facet tokens are sibling declarations in a block
  (a color role with `bg`/`bgHovered`/`fg`, a type role with family/size/weight/line-height); flat scales fit on one
  compact line (`Spacing { xs: 4px; sm: 8px; md: 12px; }`).
- **`{$Path.to.token}` references a token by its dot-path** - from styles, and from other theme values (aliasing).
  References resolve against the merged theme (across dimension overlays and package/app sources), must resolve to an
  existing token and must not form cycles (compile/LSP errors).
- Token names are identifiers, so numeric scale steps use a letter prefix by convention (e.g. `t0`...`t100`).
- Comments are `/* block */` and `// line`, like in \*.hxs; `/** ... */` doc comments document the theme, a group or a
  token (see DOCUMENTATION COMMENTS).
- **Bare identifier blocks are the arbitrary token tree; `@`-blocks are well-known CSS artifacts** with fixed semantics
  - the same two-namespace split as \*.hxs. Supported: `@keyframes` (animation timelines), `@font-face` (font
    registrations), `@counter-style` (counter styles). They are theme-owned and dimension-mergeable like everything else
    (`@keyframes` per frame, the others per descriptor), compiled into the theme definition beside `groups`, and emitted
    once per application. Styles reference them by name (`animation: pulse ...`, `font-family: 'Inter'`,
    `list-style: my-counter`); a component-local `@keyframes` shadows a theme timeline of the same name.
- Theme timelines may be parametrized with `{prop}` interpolation: the property resolves against each component
  instance that _plays_ the animation (on web, `var()` inside keyframes resolves per animated element, so one shared
  timeline serves per-instance values). Parameters are the timeline's API - document them with `/** @param ... */`;
  the LSP warns when a consuming component does not provide the property, because an unset parameter invalidates that
  frame's declaration at computed-value time - there is no implicit default.

**One theme per application, split into partial files.** Unlike dictionaries and configs (many named definitions), the
theme is deliberately singular - which is why `{$...}` references never carry a theme name. Every `*.hxt` file is a
partial contribution to the application's one theme: the filename base (`Palette.hxt`, `Semantic.hxt`, `Motion.hxt`) is
organizational only, dimensions stay per file (`Semantic.customer2.hxt`), and an overlay may override tokens defined
in a differently-named partial (`Brand.customer2.hxt` may override `Palette` tokens from `Primitives.hxt`) - organize
overlays by concern, not by forced name-pairing. Partials are not namespaces:
all files contribute to the one shared token tree; there is no per-file scoping and no import syntax between partials.

Merge rules:

- Across dimension specificity: least- to most-specific with per-file `usage`, unchanged - regardless of which partial
  file a token sits in.
- Within the same specificity and the same source, two partials defining the same **leaf token** (or the same
  `@`-artifact name) is a compile error - there is no principled order between sibling files, so collisions are
  ambiguity, not intent. Contributing to the same _group_ from several files is fine as long as leaves stay disjoint.
- Across sources, the later-registered source wins per leaf: packages ship default tokens, applications override them
  without needing a dimension - same "defaults first, overrides later" direction as the DI bootstrap.

The LSP derives everything from the indexed theme files, not from a schema - all partials form one token space:
completion after `{$` and `.`, unknown-path and alias-cycle diagnostics, hover with the resolved value/alias chain,
and go-to-definition all work for whatever structure a theme defines.

Everything below is **one possible design system** built on these rules (used for the framework's own UI components) -
not a structure the framework prescribes. It organizes tokens into two tiers:

1. **Primitives** - raw values with no meaning (palettes, font scales, spacing, shadows, motion). Never referenced by
   styles or components directly.
2. **Semantic tokens** - roles with meaning (surfaces, text, borders, color roles, type roles, elevation). Reference
   primitives via `{$...}` aliases. This is the tier styles consume and the tier a brand (dimension) overlay swaps;
   the dark/light scheme lives _inside_ values via `light-dark()`.

There is no component-token tier: per-component overrides are `*.hxs` overlays (styles merge per-declaration across
dimensions and layer across package/app sources), so structural/rule changes go into a style overlay and value
re-skinning goes into theme tokens. When one component-specific value fans out into several style rules, a theme may
define a component-named group (e.g. `Button { accent: ...; }`) - that is the theme author's convention.

Conventions this example follows (again, not framework rules): interaction states are explicit tokens (`bgHovered`,
`bgPressed`) rather than shades computed at runtime, and every background role carries its guaranteed-contrast
foreground (`bg`/`fg`, `container`/`onContainer`).

Primitives.hxt (tier 1):

```css
Palette {
  /* one block per ramp; referenced as {$Palette.Blue.t60} */
  Neutral {
    t0: #ffffff;
    t10: #f4f4f5;
    t20: #e4e4e7;
    t30: #d4d4d8;
    t40: #a1a1aa;
    t50: #71717a;
    t60: #52525b;
    t70: #3f3f46;
    t80: #27272a;
    t90: #18181b;
    t100: #09090b;
  }
  Blue {
    t10: #edf5ff;
    t20: #d0e2ff;
    t30: #a6c8ff;
    t40: #78a9ff;
    t50: #4589ff;
    t60: #0f62fe;
    t70: #0043ce;
    t80: #002d9c;
    t90: #001d6c;
    t100: #001141;
  }
  Red {
    t10: #fff1f1;
    t60: #da1e28;
    t70: #a2191f;
    t90: #520408;
  }
  Green {
    t10: #defbe6;
    t60: #198038;
    t70: #0e6027;
    t90: #022d0d;
  }
  Amber {
    t10: #fff8e1;
    t60: #b28600;
    t70: #8e6a00;
    t90: #3d2f00;
  }
}

FontFamilies {
  sans: "Inter", system-ui, sans-serif;
  serif: Georgia, serif;
  mono: "JetBrains Mono", monospace;
}
FontSizes {
  xs: 0.75rem;
  sm: 0.875rem;
  md: 1rem;
  lg: 1.125rem;
  xl: 1.375rem;
  xxl: 1.75rem;
  xxxl: 2.25rem;
}
FontWeights {
  regular: 400;
  medium: 500;
  semibold: 600;
  bold: 700;
}
LineHeights {
  tight: 1.2;
  snug: 1.35;
  normal: 1.5;
  relaxed: 1.65;
}

Spacing {
  none: 0;
  xxs: 2px;
  xs: 4px;
  sm: 8px;
  md: 12px;
  lg: 16px;
  xl: 24px;
  xxl: 32px;
  xxxl: 48px;
  gutter: 64px;
}
Sizing {
  controlsm: 24px;
  controlmd: 32px;
  controllg: 40px;
  iconsm: 16px;
  iconmd: 20px;
  iconlg: 24px;
}
Radii {
  none: 0;
  sm: 3px;
  md: 6px;
  lg: 12px;
  full: 9999px;
}
BorderWidths {
  thin: 1px;
  medium: 2px;
  thick: 3px;
}

Shadows {
  raised: 0 1px 2px rgba(0, 0, 0, 0.12);
  overlay: 0 4px 12px rgba(0, 0, 0, 0.16);
  modal: 0 12px 32px rgba(0, 0, 0, 0.24);
}
ZIndex {
  sticky: 100;
  dropdown: 200;
  overlay: 300;
  modal: 400;
  toast: 500;
}

Motion {
  instant: 0ms;
  fast: 100ms;
  normal: 200ms;
  slow: 400ms;
  easeout: cubic-bezier(0.2, 0, 0, 1);
  easein: cubic-bezier(0.4, 0, 1, 1);
  spring: cubic-bezier(0.2, 0, 0, 1.2);
}
Opacity {
  disabled: 0.4;
  muted: 0.65;
  scrim: 0.5;
}

Breakpoints {
  mobile: 480px;
  tablet: 768px;
  desktop: 1024px;
  wide: 1440px;
}

/* fonts are primitives too: registered once, referenced from FontFamilies */
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter.woff2") format("woff2");
  font-weight: 400 700;
}
```

Semantic.hxt (tier 2 - references only tier-1 tokens, never raw values):

```css
Colors {
  /* surfaces: nested containers step through layers (canvas -> surface -> raised/overlay).
     Scheme-dependent values are inline: light-dark(lightValue, darkValue) - no dark overlay file exists. */
  Bg {
    canvas:  light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t100});
    surface: light-dark({$Palette.Neutral.t0}, {$Palette.Neutral.t90});
    surfaceHovered: light-dark({$Palette.Neutral.t10}, {$Palette.Neutral.t80});
    surfaceSunken:  light-dark({$Palette.Neutral.t20}, {$Palette.Neutral.t100});
    surfaceRaised:  light-dark({$Palette.Neutral.t0}, {$Palette.Neutral.t90});
    surfaceOverlay: light-dark({$Palette.Neutral.t0}, {$Palette.Neutral.t80});
    inverse: light-dark({$Palette.Neutral.t90}, {$Palette.Neutral.t0});
  }
  Text {
    default: light-dark({$Palette.Neutral.t90}, {$Palette.Neutral.t10});
    subtle:  light-dark({$Palette.Neutral.t60}, {$Palette.Neutral.t40});
    placeholder: {$Palette.Neutral.t40}; disabled: {$Palette.Neutral.t40};
    inverse: light-dark({$Palette.Neutral.t0}, {$Palette.Neutral.t90});
    link: light-dark({$Palette.Blue.t60}, {$Palette.Blue.t40});
    linkHovered: light-dark({$Palette.Blue.t70}, {$Palette.Blue.t30});
  }
  Border { subtle: {$Palette.Neutral.t20}; default: {$Palette.Neutral.t30}; strong: {$Palette.Neutral.t50}; focus: {$Palette.Blue.t60}; danger: {$Palette.Red.t60}; }

  Roles {
    /* dark variants of the remaining roles elided for brevity */
    Primary { bg: light-dark({$Palette.Blue.t60}, {$Palette.Blue.t50}); bgHovered: light-dark({$Palette.Blue.t70}, {$Palette.Blue.t40}); bgPressed: {$Palette.Blue.t80}; fg: {$Palette.Neutral.t0}; container: light-dark({$Palette.Blue.t10}, {$Palette.Blue.t90}); onContainer: light-dark({$Palette.Blue.t90}, {$Palette.Blue.t10}); }
    Neutral { bg: {$Palette.Neutral.t20}; bgHovered: {$Palette.Neutral.t30}; bgPressed: {$Palette.Neutral.t40}; fg: {$Palette.Neutral.t90}; container: {$Palette.Neutral.t10}; onContainer: {$Palette.Neutral.t90}; }
    Danger  { bg: {$Palette.Red.t60}; bgHovered: {$Palette.Red.t70}; fg: {$Palette.Neutral.t0}; container: {$Palette.Red.t10}; onContainer: {$Palette.Red.t90}; }
    Success { bg: {$Palette.Green.t60}; fg: {$Palette.Neutral.t0}; container: {$Palette.Green.t10}; onContainer: {$Palette.Green.t90}; }
    Warning { bg: {$Palette.Amber.t60}; fg: {$Palette.Neutral.t100}; container: {$Palette.Amber.t10}; onContainer: {$Palette.Amber.t90}; }
  }
}

/* type roles: composite tokens (display/headline/title/body/label scale) */
Type {
  Display  { family: {$FontFamilies.sans}; size: {$FontSizes.xxxl}; weight: {$FontWeights.bold}; lineHeight: {$LineHeights.tight}; tracking: -0.02em; }
  Headline { family: {$FontFamilies.sans}; size: {$FontSizes.xxl}; weight: {$FontWeights.semibold}; lineHeight: {$LineHeights.tight}; }
  Title    { family: {$FontFamilies.sans}; size: {$FontSizes.lg}; weight: {$FontWeights.semibold}; lineHeight: {$LineHeights.snug}; }
  Body     { family: {$FontFamilies.sans}; size: {$FontSizes.md}; weight: {$FontWeights.regular}; lineHeight: {$LineHeights.normal}; }
  Label    { family: {$FontFamilies.sans}; size: {$FontSizes.sm}; weight: {$FontWeights.medium}; lineHeight: {$LineHeights.snug}; tracking: 0.01em; }
  Code     { family: {$FontFamilies.mono}; size: {$FontSizes.sm}; weight: {$FontWeights.regular}; lineHeight: {$LineHeights.normal}; }
}

/* elevation: shadow + z-index (+ scrim) bundled by purpose, not by number */
Elevation {
  Raised  { shadow: {$Shadows.raised}; z: {$ZIndex.sticky}; }
  Overlay { shadow: {$Shadows.overlay}; z: {$ZIndex.overlay}; }
  Modal   { shadow: {$Shadows.modal}; z: {$ZIndex.modal}; scrim: rgba(0,0,0,{$Opacity.scrim}); }
}

/* shared motion timelines, defined once per design system */
/** Attention pulse. @param pulseScale Peak scale factor of the pulsing element. */
@keyframes pulse {
  from, to { transform: scale(1); }
  50%      { transform: scale({pulseScale}); }
}
```

In this design system, styles and components reference **semantic tokens only, never primitives**.

**Dark/light is a styling concern, not a dimension**: the scheme is a per-user browser/OS setting that can flip
mid-session, so it is expressed _inside_ token values via native `light-dark(lightValue, darkValue)` rather than as an
overlay file. Both values ship in the CSS and the browser resolves them - SSR-safe by construction (the server never
needs to know the visitor's preference), no duplicated token set (unlike Material/Carbon dark themes), and the merged
theme stays a flat single-value map.

A brand overlay (e.g. `Primitives.customer2.hxt`) _is_ a dimension - a build-level choice: it overrides just the brand
ramp in `Palette` and maybe `Radii`, and every semantic token downstream follows.

Rule of thumb: **dimensions for build-level variation** (brand, culture, env); **`light-dark()` + `color-scheme` for
the color scheme**; **\*.hxs `@media` for other environmental adaptation** (`prefers-reduced-motion`,
`prefers-contrast`; `forced-colors` is browser-automatic).

Runtime/compilation:

- There is no theme name at runtime: the provider aggregates every source's partials into the single merged theme for
  the current dimension. A compiled partial keeps its filename only for diagnostics and go-to-definition.
- Color scheme: scheme-dependent tokens use `light-dark()` values, and the application root component controls the
  scheme with an ordinary property-bound declaration in its own \*.hxs - `color-scheme: {scheme};` (`light dark` =
  follow the OS, `light`/`dark` = forced by an in-app setting). Scoped to the root host, so application instances on
  one page can hold different schemes; also switches UA-rendered UI (scrollbars, form controls). No framework
  machinery: no mode API, no attribute gating - the toggle is one existing `{prop}` binding.
- Each token path becomes a CSS variable: `{$Colors.Roles.Primary.bg}` -> `--hx-colors-roles-primary-bg`; style
  references compile to `var(...)`.
- Aliases resolve as `var()` chains, not values: `--hx-colors-roles-primary-bg: var(--hx-palette-blue-t60)`. Switching
  a dimension at runtime swaps only the overridden variables, scoped to the application's root host element - no style
  recomputation, and DevTools shows the token chain. Since `@keyframes` frames reference tokens through the same
  `var()` chains, a dimension switch retunes running animations too.
- Registering `--hx-*` variables via CSS `@property` (typed tokens: enables smoothly _transitioning_ a token's value,
  e.g. animated dark-mode color changes) is reserved as a web-codegen enhancement - it is derivable from the theme, not
  theme syntax.

### COMPONENTS: \*.hxm

```xml
<!--CustomAddButton-->
<Component>
    <div>
        <button />
    </div>
    <div>{@MyDictionary.myText}</div>
    <div>{#MyConfig.myValue}</div>
    <div>{somePropertyOfCustomAddButton}</div>

    <OnUpdating property="add:extraValueForCustomComponents" name="handleUpdate">
        ...
    </OnUpdating>
</Component>

<Component>
    <FromToList name="roleSelector"
        isReadonly={#UIConfig.isReadonly | Converter1}
        from2:items={availableItems}
        from2.Item:Component=""
        to:items={selectedItems}
        add:Component={@MyComponents.CustomAddButtonTemplateName - for exactly the component with the 'add' name}
        Button:Component={@MyComponents.CustomAddButtonTemplateName - for all buttons used in FromToList.hxm component definition file, but not definitions of its child components. If there is a control with name 'Button' and Button component, handle it as an error}
        subComponentName.Button:Component={@MyComponents.CustomAddButtonTemplateName - for all buttons in the 'subComponentName' instance component definition}
        subComponentName.Button.text:Component={@MyComponents.CustomTextTemplateName - for named 'text' component inside all Button components in the 'subComponentName' instance component definition}
        add:text={@Buttons.add | Converter1}
        add:extraValueForCustomComponents={extraValue}
    >
        <from:Component>
            <div><List name="from2"/></div>
        </from:Component>
        <Button:Component></Button:Component>
    </FromToList>
    <OnAdding property="roleSelector.from:items" name="doSomethingOnAdding">
        <Update property="roleSelector:prop1" value={roleSelector.add:prop2} />
        <Add />
        <Remove />
        <Move />
        <Raise event="someEvent" />
        <Execute action="FetchSomething" prop1={prop1} prop2={prop2} prop3={prop3} />
    </OnAdding>
    <OnRaising event="roleSelector.add:click" name="handleAdding">
        <!--...-->
    </OnRaising>
</Component>
```

FromToList.hxm:

```xml
<Component>
	<div>
		<List name="from" />
		<Button name="add">{text}</Button>
    <dic>{@MyDictionary.myText}</div>
		<Button name="remove">{#MyConfig.myValue}</Button>
		<List name="to" />
	</div>
</Component>
```

#### Component overrides: `target:Component`

A `target:Component` on a component usage replaces the component the `target`
resolves to inside the used component's definition. It comes in two forms:

- **By name** — an attribute whose value is empty, a component name, or a
  dictionary/config reference:
  - `add:Component="CustomAddButton"` — the value is the replacement component's
    name.
  - `add:Component={@MyComponents.CustomAddButton}` /
    `add:Component={#UIConfig.AddButton}` — the dictionary/config entry's value
    is the component name (so the replacement can vary per dimension).
  - `add:Component=""` — the target renders nothing.
- **Inline** — a `<target:Component>…</target:Component>` child element whose
  children are the replacement definition (an empty element renders nothing).
  Inline overrides carry no attributes and must be a direct child of the usage
  they apply to. Their bindings resolve against the inline definition's own
  scope, not the enclosing component's — use the by-name form to reuse a
  component that reads the surrounding state.

**Targeting.** The `target` is a dot-separated chain resolved inside the used
component's definition file:

- The **last** segment matches either a named control (`add`) or a component tag
  (`Button`, i.e. _all_ usages of that component at that level — but not inside
  nested component definitions).
- Every **earlier** segment must name a control and descends one definition
  scope deeper: `subComponentName.Button:Component` targets all `Button`s inside
  the `subComponentName` instance's definition; `subComponentName.Button.text`
  targets the `text` component inside those buttons.

A `name` match takes precedence over a `tag` match. A segment that names _both_ a
control and a component tag at the same level is an error. Overrides are resolved
at build time and are not stored in state, so they do not swap dynamically as
state changes; use the dictionary/config value form for dimension-driven
selection.

Simple property binding in nameless components:

```xml
Login.hxm
<Input value={loginUsername}/>
<Input value={loginPassword}/>

Home.hxm
<Login loginUsername={data.user} loginPassword={data.password}/>
```

#### Component roots: declarative vs programmatic

An `*.hxm` file is **always a declarative component** — a template. A **programmatic component** is a TypeScript
class extending the framework's `Component` base; it has no `*.hxm` file at all. The two are distinguished by file
type, not by a root attribute: `<Component>` roots a template, a `Component` subclass is code. Both share one tag
namespace (a declarative `Button.hxm` and a `class Button` collide — a duplicate-definition error).

#### Typings frontmatter

Component prop and event contracts are **TypeScript types**, not a DSL type grammar. The analyzer reads them at
build/dev-time through the TypeScript compiler; compilers stay per-file and TS-free, and runtime/on-the-fly
compilation is unaffected (typings never reach compiled definitions). A component declares its contract in a
frontmatter header via `props:` / `events:`, whose value is a TypeScript type — **either** a reference to a named
type **or** an inline type literal:

```
---
props: DataTableProps
---
<Component>...</Component>
```

```
---
props: {
  /** Visual emphasis of the table. @default 'default' */
  variant?: 'primary' | 'secondary' | 'default'
  fullWidth?: boolean
  columns: ColumnDef[]
}
events: {
  /** Raised after a row is committed. */
  rowSaved: RowData
}
---
<Component>...</Component>
```

Rules:

- **The DSL never parses the TypeScript.** The frontmatter parser captures a `props:` / `events:` / `params:` value
  as opaque text (a bare type name or a brace-balanced `{ … }` body) and hands it to the TypeScript compiler, which
  resolves and checks it. This is the line between _delegating to TypeScript_ (supported) and a fake-TypeScript
  subset grammar (never).
- **Reference vs inline.** `props: SomeType` resolves the named type through the TS program, including whatever it
  imports — use it for shared or imported types. An inline `props: { … }` body has no imports, so any named type it
  mentions (`ColumnDef`) must be **ambient/global**; a module-exported type belongs in the reference form (a `.ts`
  module that imports it). Inline is for self-contained or global contracts, co-located with the component.
- **Props are data.** Component prop types must be data-like — the analyzer rejects function-typed members. Provenance
  is not part of the type: a prop typed `string` accepts a dictionary reference, a config value, a literal or state,
  and the analyzer checks the _resolved value type_ of whatever source is bound against the declared type, regardless
  of source. (The framework no longer constrains a prop to be dictionary-sourced; inline string values are allowed.)
- **Enums** are ordinary TypeScript string or numeric enums / unions (`'a' | 'b'`), inline or referenced. An inline
  string value at a usage site (`variant="primary"`) is checked against the prop's union/enum.
- **Docs are TSDoc.** Prose and `@default` / `@example` / `@deprecated` live in `/** */` TSDoc on the type's members,
  read back through the TS symbol API — one docs source shared with converters and actions. There is no separate
  frontmatter doc convention for props.
- **Defaults** are documented with TSDoc `@default` and applied by the implementation (a template that seeds the
  value when unset, or the component class); the type itself carries no default value.

The same applies to `events:` (payload types). Converter and action parameter types are not declared in a header at
all — they come directly from the implementing TypeScript class's `TParams` (see CONVERTERS and ACTIONS).

#### Attribute values

**How a value is written is what decides its meaning** — one spelling per concept, so no value is ambiguous and none
needs a second reading:

- **quoted text is static**: `variant="primary"`, `label='Save changes'`. Single and double quotes are fully
  interchangeable — the quote character carries no meaning of its own, so a consumer normalizes to whichever its lint
  rules prefer. Static text is valid only where the target declares a `string` or an enum/union type (an inline
  `'a' | 'b'` union or a referenced TypeScript enum/union) and is type-checked against it — which keeps arbitrary
  hardcoded translations inexpressible (a free-form string prop has nowhere to land) while letting enum values be
  written inline;
- **a value-less attribute is `true`**: `isVisible` is the short form of `isVisible={true}`;
- **braces hold an expression**: `value={userName}`, `title={@Buttons.save | Truncate(length: 40)}`. Braces are
  **required** for every expression, never optional, so adding a converter never reshapes a binding and a dynamic value
  is always visible as one;
- **the brace short form** binds a property to the state of the same name: `{userName}` is `userName={userName}`, and
  it takes converters like any other expression (`{userName | Truncate(length: 40)}`).

Element text follows the same split: `Save` is static text, `{@Buttons.save}` is a binding.

#### Binding sources

Inside `{...}` — and equally in converter arguments and `@hx-*` qualifier arguments, which share one grammar — a
source's kind is decided by its **lexical form alone**:

- a bare identifier/path is a **property path**: `{loginUsername}`, `{data.user}`;
- `@Dictionary.key` is a dictionary reference, `#Config.path` a config reference;
- `true`, `false` and numbers (`0`, `1.5`, `-2`) are **literals**: `{true}`, `{0}`. Booleans and numbers may be
  literal because their type cannot carry content — they never need translation and never vary by customer;
- a **quoted string** is a **string literal**: `{'primary'}` or `{"primary"}`, type-checked like static text;
- converters chain with `|` (see CONVERTERS).

Because a bare token is always a reference and a string literal is always quoted, the source a converter chain reads
is never in doubt: `{'circle' | Pick}` converts a string literal, `{circle | Pick}` converts the state at `circle`.

Compiled binding sources are discriminated by type — `{ "type": "state" | "dictionary" | "config" | "literal", ... }`
— with literals carrying valid JSON in `value` (a quoted string is normalized to its JSON form, `'primary'` →
`"primary"`, coerced by one `JSON.parse`; the static text of a quoted attribute compiles to that same literal). All
sources keep their reactivity as before; literals are static.

Switch:

```xml
<Switch value={variant}>
    <Case is="primary">...</Case>
    <Case is="danger">...</Case>
    <Default>...</Default>
</Switch>
```

If:

```xml
<If value={isSaving}>...</If>
<Unless value={isSaving}>...</Unless>
<If value={variant} is="primary">...</If>
<If value={rows} is={3}>...</If>
```

The condition vocabulary is identical to `@hx-if` in \*.hxs: the subject is the `value` argument in both formats,
comparison arguments are the same `is`/`isNot` names with the same operand grammar (binding sources — properties,
enum string literals, boolean/number literals), and truthiness is the subject alone. Negation is where the two differ
in spelling only: the component format has the `<Unless>` tag, while a style — having one condition qualifier and no
tags — negates through its operand, as `@hx-if(value: {x}, is: {false})`. Learn the condition grammar once, use it in
both formats.

List:

```js
users = [
  { id: 1, fullname: "full name 1" },
  { id: 2, fullname: "full name 2" },
  { id: 3, fullname: "full name 3" },
]
```

```xml
<div>
	<List name="myUsers" items={users} key="id" Item:extraProp={extraValue} Item:Component={@Components.CustomListItem} />
</div>
```

CustomListItem.hxm:

```xml
<Component>
  <div> <!--Dynamic name="<id value>" is the value of the "key" or index 0, 1, 2 etc if key="id" is not specified-->
    <div name="identifier">{id}</div>
    <div name="full">{fullname}</div>
    <div name="extra">{extraProp}</div>
  </div>
</Component>
```

For now platform components cannot have properties like "some.property" if they are not supported, i.e. in Web HTML although the framework supports it, so it is up to a developer.

Every component gets its properties by itself from StateManager because it depends on its logic, i.e. some property is used as name and doesn't need value.
Every component subscribes to updates by itself as well because of the above

Lifecycle functions:
-build(usage, definition, context, parent, etc.)
-mount()
-update()
-unmount()
-destroy()
Every component implementation subscribes to needed notifications in states, dictionaries etc. by itself according to its logic

Create a package "web" with implementation of PlatformComponent for web

### DOCUMENTATION COMMENTS

All source formats except \*.hxs support doc comments: markdown text plus a small tag set (`@param`,
`@example`, `@deprecated`, `@see`). A doc comment is `/** ... */` — a regular comment whose inner text starts with
`*` — everywhere: JSONC bodies, the CSS-like format, and frontmatter headers. XML bodies carry no doc comments;
everything documentable about a component lives in its header.

Placement per format:

- `*.hxm`: the leading `/** */` in the frontmatter header documents the component. Per-member prose is **TSDoc** on
  the `props:` / `events:` type members (`/** */` inside the type text, read back through the TS symbol API), the same
  one docs source shared with converter and action parameters — there is no separate frontmatter doc convention for
  props.
- `*.hxs`: no doc comments for now - styles are bound to their component by filename and are never referenced by
  name, so there is no reference site to surface docs at. Plain `/* */` and `//` comments annotate sections and
  rules; editor tooling derives hover/override info from the rules themselves. Revisit if named reusable style
  fragments are introduced (they would be a referencable API).
- `*.hxt`: inline doc comments above a token declaration or a group block, keyed by the dot-joined path (e.g.
  `Colors.Bg.canvas`, `Colors.Roles.Primary`); a detached doc comment at the top of the file (followed by a blank
  line before the first group) documents the theme itself. A doc comment above an `@`-artifact documents it by name;
  `@param name text` documents a `@keyframes` timeline's `{prop}` parameters, like dictionary entry parameters.
- `*.hxd` / `*.hxc`: inline doc comments above individual entries; `@param name text` documents an entry's
  interpolation `{param}`s; a comment above the root `{` documents the file's definition.

```
---
/**
 * A confirmation dialog with OK/Cancel actions.
 * @example <ConfirmDialog title={@Dialogs.DeleteTitle} />
 */
props: {
  /** Text shown in the dialog header. */
  title: string
}
---
<Component>...</Component>
```

```jsonc
{
  /** Shown when deletion needs confirmation. @param name The item being deleted. */
  "DeleteWarning": "Delete {name}?",
}
```

```css
/** The framework's default design system. */

Colors {
  Bg {
    /** Base surface color for cards and panels. */
    canvas: {$Palette.Neutral.t10};
  }
}
```

Docs never reach runtime payloads: compilers emit them as separate sidecar artifacts (`Name.docs.json`, an
`IDocsManifest`), which packages ship under the `hxdocs` export condition next to the per-kind definition
conditions (`hxm`, `hxd`, ...). Sidecars can additionally be bundled into a single package-level docs manifest
(same shape, plus `package`/`version`) for documentation portals. The webpack plugin's library mode emits both:
`emitDocs` (per-source `*.docs.json` next to the `emitJson` definitions) and `emitDocsBundle` (one `hx.docs.json`).
Editor tooling (hover, completion docs) reads doc comments directly from workspace sources and joins shipped docs
to definitions by kind + name.

### SERVICES

A service is a plain **TypeScript class** `extends Service`, provided through `IApplicationBootstrap.services` like
every other framework element and resolved by its **class** rather than by a name (nothing in the DSL references a
service), through `this.context.services.get(SomeService)`. It is a singleton per application: built on first
resolution, dropped when the application stops. Actions reach services the same way, through their own context.

HttpService - provides many scenarios with requests:

- sequential requests
- parallel requests
- polling with intervals and specified number of retries
- optimistic updates with pending statuses
- etc
- Can inject other services.

### CONVERTERS

A converter is a plain **TypeScript class** `extends Converter<TValue, TReturn, TParams>`, with `async format`
(value → view) and `async parse` (view → state), so one chain serves two-way bindings. It is provided through
`IApplicationBootstrap.converters` like other framework elements and may inject other converters and providers. There
is no DSL header file: the analyzer discovers converter classes by their base type and reads the parameter contract
straight from `TParams` (`Parameters<Class["format"]>[1]`).

- **Binding name** = the class name minus the required `Converter` suffix — `TruncateConverter` → `Truncate` (the name
  it is provided under in the bootstrap). A class missing the suffix is a diagnostic.
- **`TParams` must be data.** It is constrained by `DataObject<TParams>`, which rejects function-typed members at any
  depth (callbacks are events, not data). Nested data objects and arrays are allowed; methodful objects (`Date`,
  `Map`, class instances) are not, since converter arguments are bound from the DSL's data sources.

```ts
interface TruncateParams {
  /** Maximum number of characters to keep. */
  length: number
  /** Appended when the value is shortened. */
  ellipsis?: "dots" | "none"
}

export class TruncateConverter extends Converter<string, string, TruncateParams> {
  async format(value: string, params: TruncateParams): Promise<string> {
    return value.length > params.length ? value.slice(0, params.length) : value
  }
}
```

Converters are applied to a binding source with the pipe syntax:

```
source | converter | converter(name: value, ...) | ...
```

- The source is any binding form: a property path, `@Dictionary.key`, `#Config.path`, a boolean, number or
  enum string literal (see Binding sources in COMPONENTS).
- A converter without arguments is written bare: `| Truncate`. Empty parens are a compile error — there is one
  canonical spelling.
- Arguments are named-only `name: value` pairs, the same convention as `@hx-*` qualifiers in \*.hxs: each argument
  maps 1:1 to a typed parameter of the converter class. Positional arguments do not exist.
- Argument values use the binding-source grammar: a bare identifier is a property path, `@...` is a dictionary
  reference, `#...` is a config reference, `true`/`false`/numbers are literals, and a single-quoted `'text'` is a
  string literal type-checked against the parameter's declared enum/union type — e.g. `Pad(side: 'left')`.
- Reactivity falls out of the argument kind: a property argument re-evaluates the binding when the property changes,
  dictionary/config arguments follow culture/dimension switches, literals are static. There are no
  special semantics per argument — they are ordinary binding sources.
- The chain runs left-to-right for `format` (state → view) and right-to-left for `parse` (view → state). Each
  converter receives its resolved arguments as one plain object in both directions: `format(value, args)` /
  `parse(value, args)`.
- An argument is a plain source, not a chain: converters inside arguments (`length: #Cfg.len | toNumber`) are a
  compile error.

```xml
<Button
    price={data.price | Round(digits: #UIConfig.digits) | Currency(code: #UIConfig.currency)}
    title={@Products.title | Truncate(length: #UIConfig.len, ellipsis: #UIConfig.ellipsis)}
    created={data.createdAt | DateFormat(format: @Formats.shortDate)}
    width={#SomeConfig.value | Scale(by: zoomLevel)}
/>
```

The `price` binding compiles into:

```json
{
  "type": "state",
  "value": "data.price",
  "converters": [
    { "name": "Round", "args": { "digits": { "type": "config", "value": "UIConfig.digits" } } },
    { "name": "Currency", "args": { "code": { "type": "config", "value": "UIConfig.currency" } } }
  ]
}
```

Parsing happens in the compiler; the runtime binder consumes structured data only — it resolves argument sources,
subscribes to the reactive ones and passes the resolved args object into `format`/`parse`.

Typings and docs come straight from the TypeScript class — no header file. `TParams`'s members are the argument
contract, and their prose comes from TSDoc on those members, read back through the TS symbol API. Contracts ship in
the package's `hx.meta.json` (`converters` section) so a consuming package validates calls without re-scanning the
library's sources.

The analyzer validates converter chains with the same codes in builds and editors: unknown converter, unknown and
missing argument names, and each argument value through the ordinary binding-source machinery — the declared params
act as the argument's contract, so string-literal arguments check against a param's enum/union and other literals
kind-check exactly like component props.

### ACTIONS

An action is a plain **TypeScript class** `extends Action<TParams>` with a single `async Execute(params): Promise<void>`;
it may inject services and the `ConfigProvider`. Like converters, it is discovered by its base type (no header), the
**registry name** is the class name minus the required `Action` suffix (`SubmitAction` → `Submit`) under which it is
provided through `IApplicationBootstrap.actions`, and `TParams` is `DataObject`-constrained (no functions at any depth).

An action is run by the builtin `<Execute>` component. Its `action` attribute is a registry reference naming the
action class; the **sibling attributes are the action's named parameters** (not `param1`/`param2`), validated
dependently against `TParams` — unknown action, unknown/missing argument, and value-kind checks, exactly like
converter arguments.

```xml
<Execute action="Submit" id={123} result={savedId} />
```

Parameter direction is expressed with TypeScript's native `readonly`:

- a **`readonly` parameter** is an **input** — any binding source may be bound (dictionary, config, literal, state,
  prop) and its value is kind-checked against the parameter type;
- a **mutable parameter** is **in-out** — the action writes back to it, so it must bind a **writable state/prop path**
  (a literal, dictionary or config there is an error); it is not value-checked, since state is gradual.

```ts
interface SubmitParams {
  /** Row id to submit (input). */
  readonly id: number
  /** Receives the saved id (in-out — must bind a writable state path). */
  result: number
}

export class SubmitAction extends Action<SubmitParams> {
  async Execute(params: SubmitParams): Promise<void> {
    /* ...perform the side effect, write params.result... */
  }
}
```

### PROVIDERS

Provide dictionary definitions, component definitions, style definitions, theme definitions, configs definitions (in yhis case a config to fetch other configs needs to be available earlier, i.e. defined at compile time).

- Can inject ConfigProvider
- Can inject services

index.html -> `<div id="root"></div>`

index.js -> `new MyApplication().run()`

### OTHER NOTES

Configs don't have interpolation with component properties. They can reference own properties and other configs

Should i implement styles in the same approach as Dictionaries via common instances and bindings?

Dictionaries and configs in the first version don't have references to other dictionaries or configs, only to component properties. It will be in v2.

Definition providers in the first version don't have events to notify about changes in definitions or their parts, like dictionaryChanged, dictionaryEntryChanged, dictionariesChanged, dictionaryEntriesChanged etc. so that managers can subscribe and update corresponding bindings etc.
