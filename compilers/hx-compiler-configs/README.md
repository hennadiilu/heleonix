# @heleonix/hx-compiler-configs

Compiler for Heleonix config files (`*.hxc`).

```ts
import { ConfigCompiler } from "@heleonix/hx-compiler-configs"

const dimension = { culture: "en-US", customer: "customer2", env: "test" }
const compiler = new ConfigCompiler()

const definition = await compiler.compile(source, dimension, { name: "UIConfig" })
```

Config entry values are parsed as JSON (so `true`, `42`, `[1,2,3]`, `{"a":1}` Just Work).
If a value isn't valid JSON, it is kept as a string. To force the string interpretation
on a value that happens to look like JSON, add `type="string"` on the entry element.
