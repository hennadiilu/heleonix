# Heleonix for VS Code

Language support for Heleonix source files:

- **`*.hxm`** components — XML-like syntax with theme-driven semantic highlighting
  (component tags, `@dictionary` / `#config` / state references, `| converters`,
  prefixed property scopes), diagnostics for invalid bindings and unknown
  references, and autocompletion (`@`, `#`, `<`, properties).
- **`*.hxd`** dictionaries — frontmatter header + JSONC, with highlighting of
  `{…}` interpolations and validation of their references.
- **`*.hxc`** configs — frontmatter header + JSONC.
- **`*.hxs`** styles — CSS-like syntax with highlighting of declarations, pseudos,
  `@media` / `@keyframes`, `@hx-*` qualifiers and every `{…}` binding source
  (`{$theme}`, `{@dictionary}`, `{#config}`, `{state}`); autocompletion of theme
  tokens, dictionary/config names and entries, the styled component's properties
  in declaration values, qualifiers and their arguments;
  hover docs; go-to-definition and find-references for dictionary/config entries
  (a style's usages also count toward the unused-entry check) and for theme
  tokens and the groups `@hx-apply` expands; diagnostics for unknown references.
- **`*.hxt`** themes — token groups with highlighting, `{$…}` alias completion,
  hover, go-to-definition and find-references across styles and other partials.

Highlighting follows the **active color theme** via TextMate scopes plus standard
LSP semantic token types — nothing is hard-coded.

Converters, actions, style qualifiers and programmatic components are read live
from TypeScript, re-read on save with no rebuild: every `tsconfig.json` project
inside the workspace folders (following `references`), so a monorepo opened at
its root works whether or not the root has a `tsconfig.json` of its own. Each
package is typed under its own compiler options. Installed packages — the
dependencies of every package in the workspace — contribute theirs through their
`hx.meta.json`; a workspace package's own manifest is ignored, since its sources
are read directly.

Each file sees what its package can use, as the package's own build does: the
package and those it depends on (`dependencies`, `peerDependencies`,
`optionalDependencies`, and its own `devDependencies`), found by name among the
workspace's packages. A library never sees its applications' components,
dictionaries, converters or theme tokens; find-references, go-to-definition and
unused-entry checks still span the whole workspace. A package's analysis,
TypeScript programs included, is built the first time one of its files is
needed and dropped once none is open, and only dependencies that can declare
framework classes (those reaching `@heleonix/hx-core`) are compiled for it.

## Architecture

A thin LSP client (`src/extension.ts`) that launches the
[`@heleonix/hx-language-server`](../hx-language-server) language server. The
server reuses the framework's own `@heleonix/hx-language` grammar and
`@heleonix/hx-compiler-core` parsers, and indexes definitions by scanning `hx*`
files in the workspace (behind a pluggable source layer for future HTTP / module
sources).

## Develop / run from source

```bash
pnpm install
pnpm --filter @heleonix/hx-language-server --filter heleonix-hx-language-server-vscode run build
```

Then press **F5** (or pick **Run Heleonix Extension** in the Run & Debug panel)
to launch an Extension Development Host with this extension loaded from source —
no packaging or marketplace install required. Use `pnpm --filter heleonix-hx-language-server-vscode run watch`
for incremental rebuilds.

## Configuration

Project decisions live in `hx.config.json`, which the build plugins read too, so
the editor compiles and reports what the build does: which sources each package
compiles (`include`/`exclude`), its `dimensions`, the TypeScript projects to
discover classes in, and the level of each diagnostic code. The file gets
completion and validation from the bundled schema, and its edits apply as you
type; a configuration that fails to load shows its error on the file. In a
monorepo, packages are those its workspace manifest declares
(`pnpm-workspace.yaml`, `package.json` `workspaces`, `lerna.json`). The
settings below apply where no `hx.config.json` sets a value.

## Settings

- `heleonix.hx.diagnostics.enable` — toggle diagnostics.
- `heleonix.hx.diagnostics.severity` — levels by diagnostic code
  (`error`, `warning`, `information`, `hint`, `off`), under `hx.config.json`'s own.
- `heleonix.hx.exclude` — extra folder names to skip when indexing.
- `heleonix.hx.definitionSources` — extra compiled-definition sources (installed package, `http(s)` URL, or local manifest path).
- `heleonix.hx.typescript.projects` — the TypeScript projects to discover classes in: `tsconfig` files, folders, or
  glob patterns relative to each workspace folder, such as `apps/*/tsconfig.app.json` or `packages/ui` (default
  `**/tsconfig.json`). When nothing matches, the folder's nearest `tsconfig.json` above it is used.
- `heleonix.hx.typescript.exclude` — glob patterns of TypeScript files left out of discovery (test files and
  `spec`/`test`/`__tests__` folders by default).
- `heleonix.hx.typescript.linkedPackages` — also read dependencies linked in from outside the workspace folders,
  for opening one app of a monorepo alone (off by default).
- `heleonix.hx.trace.server` — LSP trace level.
