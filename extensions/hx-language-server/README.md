# @heleonix/hx-language-server

Editor-agnostic Language Server (LSP) for Heleonix sources - components (`*.hxm`), dictionaries (`*.hxd`), configs
(`*.hxc`), styles (`*.hxs`), themes (`*.hxt`) - and their `hx.config.json`. The
[VS Code extension](../hx-language-server-vscode) bundles it; any LSP host (WebStorm, Neovim, Zed, ...) can run it.

## What it does

- **Diagnostics** - the same analysis builds run (`@heleonix/hx-analyzer`), at the levels the workspace's
  `hx.config.json` sets per code, so the editor and the build report the same.
- **Completion, hover, go-to-definition, find-references** - components, properties, dictionaries, configs, theme
  tokens, style qualifiers, converters and actions.
- **Semantic tokens** - Heleonix spans mapped to standard token types, colored by the editor theme.

It reads the workspace the way its builds do:

- **Packages** - those the workspace manifest declares (`pnpm-workspace.yaml`, `package.json` `workspaces`,
  `lerna.json`), else every folder holding a `package.json`. A file sees its own package and what that depends on.
- **Sources** - what each package's `hx.config.json` compiles (`include`, `exclude`, `dimensions`).
- **TypeScript** - converters, actions, style qualifiers and programmatic components, read live from every
  `tsconfig.json` project (`typescript` in `hx.config.json`); installed packages through their `hx.meta.json`.
- **Laziness** - a package's analysis, its TypeScript programs included, is built when one of its files is first
  needed and dropped once none is open.

## Running it in a host

```bash
hx-language-server --stdio        # or: node dist/server.js --stdio | --node-ipc | --socket=<port>
```

The host should:

- send the Heleonix languages' documents - and `hx.config.json` (plus `hx.dimensions.json`) documents, so their
  unsaved edits apply as typed;
- support dynamic registration of `workspace/didChangeWatchedFiles` with relative patterns: the server watches the
  sources, TypeScript projects, workspace manifests and configuration files it reads, including outside the open
  folders.

### Options

Passed as `initializationOptions`, and again under `settings.heleonix.hx` of `workspace/didChangeConfiguration` to
change them live. All optional; a workspace's `hx.config.json` wins over the project-level ones.

```jsonc
{
  "exclude": ["coverage"], // folder names never indexed, besides node_modules, dist, temp, out
  "diagnostics": {
    "enable": true,
    "severity": { "HX_ANALYZER_0002": "warning" }, // levels by code, where no hx.config.json sets one
  },
  "definitionSources": ["@acme/widgets"], // compiled definitions beyond the workspace
  "typescript": { "projects": ["**/tsconfig.json"], "exclude": ["**/*.spec.ts"], "linkedPackages": false },
  "workspaceTrusted": true, // custom definition-source modules run only in a trusted workspace
}
```

The shape is [`ILanguageServerOptions`](src/settings/ILanguageServerOptions.ts); it mirrors the `heleonix.hx.*`
settings of the VS Code extension.

### Commands

- `heleonix.reloadDefinitions` (`workspace/executeCommand`) - re-pulls every external definition source.

## Build

```bash
pnpm --filter @heleonix/hx-language-server run build
```
