# @heleonix/hx-compiler-dictionaries

Compiler for Heleonix dictionary files (`*.hxd`).

```ts
import { DictionaryCompiler } from "@heleonix/hx-compiler-dictionaries"

const dimension = { culture: "en-US", customer: "customer2", env: "test" }
const compiler = new DictionaryCompiler()

const definition = await compiler.compile(source, dimension, { name: "Buttons" })
```

See the root `README.md` for the `.hxd` syntax.
