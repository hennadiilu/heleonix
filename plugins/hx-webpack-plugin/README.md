# @heleonix/hx-webpack-plugin

Webpack loader + plugin that compile Heleonix `*.hxm`/`*.hxd`/`*.hxc`/`*.hxs`/`*.hxt`
sources into definition-source classes consumed by `@heleonix/hx-core` at runtime.

## App usage

```js
import { HxWebpackPlugin } from "@heleonix/hx-webpack-plugin"

export default {
  plugins: [
    new HxWebpackPlugin({
      dimensions, // the app's dimension definitions
      include: ["./src"], // scanned for sources; aggregated per kind
    }),
  ],
}
```

The plugin scans `include`, compiles each source, and exposes one aggregated
definition-source per kind under the bare specifiers `hx-compiled-components`,
`hx-compiled-dictionaries`, `hx-compiled-configs`, `hx-compiled-styles`,
`hx-compiled-themes`. Register those in the application bootstrap.

`include`, `exclude`, `dimensions` and the diagnostic levels are better kept in the
package's `hx.config.json` (the nearest one above the webpack `context`), which the
editor reads too - so the build and the editor compile and report the same:

```jsonc
// hx.config.json
{
  "include": ["src"],
  "dimensions": "./hx.dimensions.json",
  "diagnostics": { "severity": { "HX_ANALYZER_0002": "warning" } },
}
```

Options passed to the plugin win over the file. With `validate`, each finding is
reported at its configured level: `error` fails the build, `warning` is a warning
(an error with `failOnWarnings`), and `information`, `hint` and `off` are not
reported by the build.

In watch mode (and under the dev server) editing `hx.config.json` - or the dimensions
file it names, or adding a configuration above the package - rebuilds with the new
settings. A configuration that fails to load is reported as a build error at the
line at fault; the build carries on with the defaults until it is fixed.

## Shipping uncompiled definitions in a library

A library can publish its raw `*.hxm`/`*.hxd`/... sources so a consuming app compiles
them **as part of its own build**, through the app's `HxWebpackPlugin`. This is
the "advanced" distribution shape: the consumer imports individual sources and assembles
them into a custom definition source (versus the precompiled `.json` +
definition-source shape produced by `emitJson`/`emitDefinitionSources`).

No build step is required for the raw files — publish them as-is:

**1. Include the sources and expose them via `exports`.** With an `exports` map, only
listed paths are importable, so map the source folders (the extension stays in the
specifier, so no export conditions are needed):

```jsonc
{
  "files": ["src"],
  "exports": {
    "./components/*": "./src/components/*.hxm",
    "./dictionaries/*": "./src/dictionaries/*.hxd",
    // ...one entry per kind folder you ship
  },
}
```

A library with no `exports` field can skip this — any file path resolves directly.

**2. Consumers import the raw sources.** Any Heleonix source webpack resolves — including
from `node_modules` — runs through the loader, so a direct import yields the compiled
definition:

```ts
/// <reference types="@heleonix/hx-plugin-core/sources" />
import { DefinitionSource } from "@heleonix/hx-core"
import type { IDictionaryDefinition } from "@heleonix/hx-language"
import buttons from "@acme/ui/dictionaries/Buttons.hxd" // → compiled IDictionaryDefinition

export class MyDictionaryDefinitionSource extends DefinitionSource<IDictionaryDefinition> {
  // ...assemble/return imported definitions with custom logic
}
```

The `/// <reference .../>` (or `"@heleonix/hx-plugin-core/sources"` in
`compilerOptions.types`) types every `*.hx*` import as its definition interface. It only
supplies types — the app's `HxWebpackPlugin` still produces the values.

### Things to know

- **Dimensions are the app's.** A raw import is compiled with the **consuming app's**
  configured `dimensions`. A dimensioned source such as `Button.dark.hxd` therefore only
  applies when the app declares a dimension whose values include `dark`; if it doesn't,
  the import resolves to `null` and the loader emits a warning (`HX_PLUGIN_0201`). A
  library shipping dimensioned sources must document which dimension values its file
  names use.
- **One file, one definition.** A direct import returns the single definition for that
  file. To combine every dimension variant of a name (e.g. `Button` + `Button.dark`),
  import each variant, or use the precompiled definition-source distribution shape
  instead, which groups variants for you.
- The app's own scan excludes `node_modules` by default, so library sources are never
  auto-aggregated — they enter the build only through the consumer's explicit imports.
