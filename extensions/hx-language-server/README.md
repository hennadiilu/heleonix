# @heleonix/hx-language-server

Language Server (LSP) for Heleonix source formats (`*.hxm`, `*.hxd`, `*.hxc`).

Provides:

- **Diagnostics** — invalid binding expressions and unknown `@dictionary` /
  `#config` references in `*.hxm`; JSONC + frontmatter structure and
  interpolation references in `*.hxd` / `*.hxc`.
- **Semantic tokens** — Heleonix-specific spans mapped to standard LSP token
  types so the editor theme colors them.
- **Completion** — dictionaries (`@`), configs (`#`), component tags (`<`) and
  component properties.

The server reuses `@heleonix/hx-language` (binding/name grammar) and
`@heleonix/hx-compiler-core` (XML / JSONC parsers). Definitions are gathered by
the workspace scanner ([WorkspaceDefinitionSource](src/index/WorkspaceDefinitionSource.ts))
behind the pluggable [IDefinitionSource](src/index/IDefinitionSource.ts) contract;
additional sources (HTTP endpoints, executable modules) can be registered with
the [DefinitionRegistry](src/index/DefinitionRegistry.ts) without touching
consumers.

It is editor-agnostic and is bundled into the
[VS Code extension](../hx-language-server-vscode); the same server can back the WebStorm extension.

## Build

```bash
pnpm --filter @heleonix/hx-language-server run build
```
