# Heleonix for VS Code

Language support for Heleonix source files:

- **`*.hxm`** components — XML-like syntax with theme-driven semantic highlighting
  (component tags, `@dictionary` / `#config` / state references, `| converters`,
  prefixed property scopes), diagnostics for invalid bindings and unknown
  references, and autocompletion (`@`, `#`, `<`, properties).
- **`*.hxd`** dictionaries — frontmatter header + JSONC, with highlighting of
  `{…}` interpolations and validation of their references.
- **`*.hxc`** configs — frontmatter header + JSONC.

Highlighting follows the **active color theme** via TextMate scopes plus standard
LSP semantic token types — nothing is hard-coded.

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

## Settings

- `heleonix.hx.diagnostics.enable` — toggle diagnostics.
- `heleonix.hx.exclude` — extra folder names to skip when indexing.
- `heleonix.hx.dimensionsPath` — reserved (dimension-aware features).
- `heleonix.hx.definitionSources` — extra compiled-definition sources (installed package, `http(s)` URL, or local manifest path).
- `heleonix.hx.trace.server` — LSP trace level.
