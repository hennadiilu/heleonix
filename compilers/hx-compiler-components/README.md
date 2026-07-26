# @heleonix/hx-compiler-components

Compiler for Heleonix component files (`*.hxm`).

```ts
import { ComponentCompiler } from "@heleonix/hx-compiler-components"

const dimension = { culture: "en-US", customer: "customer2", env: "test" }
const compiler = new ComponentCompiler()

const definition = await compiler.compile(source, dimension, { name: "CustomAddButton" })
```

The compiled output is a JSON definition compatible with the `IComponentDefinition`
shape consumed by `@heleonix/hx-core`'s `ComponentDefinitionProvider`.

Attribute values and inner text content are parsed as binding expressions:

| Form                              | Binding type    |
| --------------------------------- | --------------- |
| `propName`, `data.user`           | `state`         |
| `@Dict.key`, `@Dict.Sub.k`        | `dictionary`    |
| `#Config.key`, `#Config.Sub.k`    | `config`        |
| `... \| converterA \| converterB` | adds converters |

The root `<Component>` element is a compile-time wrapper only. Its children become
the compiled definition's `children`, and `tag` is set to the component `name`.

Inner text that is a binding expression becomes a single `Content` child:

```json
{ "tag": "Content", "name": "content", "properties": [{ "name": "value", "binding": { ... } }] }
```

Any other text content, or mixing text bindings with element children, is a compile error.
