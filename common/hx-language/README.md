# @heleonix/hx-language

Source of truth for the Heleonix DSL: syntax tokens, helpers, and the
language-level type contracts shared by compilers, the runtime, platforms,
and any external tooling (IDE extensions, lint rules, bundler plugins)
that needs to recognise or produce Heleonix sources.

The package is purely declarative: no runtime side effects, no internal
dependencies. Constants, helpers, and type contracts are grouped by concern
(components, dictionaries, configs, etc.).

## Groups

- `names` — fully-qualified component / property / entry names.
- `bindings` — binding expression grammar (`@`, `#`, `|`).
- `interpolation` — `{...}` substitution grammar.
- `extensions` — source file extensions.

## Example

```ts
import { joinFQPropertyName, parseExpression, extractParameters, TEMPLATE, EXT_KIND } from "@heleonix/hx-language"

const fq = joinFQPropertyName("Parent.Child", "value")

const binding = parseExpression("@Buttons.add | toUpper")

const params = extractParameters("Hi {username}!")

const kind = EXT_KIND[TEMPLATE]
```
