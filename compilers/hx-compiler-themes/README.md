# @heleonix/hx-compiler-themes

Compiler for Heleonix theme files (`*.hxt`).

Produces a structured JSON of theme groups (`Colors`, `Spacing`, `Typography`,
`Layers`, `Breakpoints`, `Components`, ...). Each leaf element exposes its
attributes (typically `value`) – the runtime theme manager translates this
tree into CSS variables.

```ts
import { ThemeCompiler } from "@heleonix/hx-compiler-themes"

const compiler = new ThemeCompiler()
const definition = await compiler.compile(source, dimension, { name: "Light" })
```
