# @heleonix/hx-compiler-styles

Compiler for Heleonix style files (`*.hxs`).

The final compiled JSON shape for styles is **TBD** in the framework spec;
this package currently produces a faithful, JSON-serializable AST of the
`*.hxs` source (root element + rules with attributes and nested rules /
lifecycle / conditional blocks). When the style runtime stabilizes, this
compiler will refine the output without breaking the public API.

```ts
import { StyleCompiler } from "@heleonix/hx-compiler-styles"

const compiler = new StyleCompiler()
const definition = await compiler.compile(source, dimension, { name: "MyComponent" })
```
