# AGENTS.md

Single source of truth for AI coding agents (Claude Code, Cursor, Codex, Copilot, etc.) working in this repository. Tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`, ...) must only point here — never duplicate content into them.

## Hard rules

- **No external/3rd-party runtime dependencies anywhere in the framework.** Build tooling (rollup, esbuild, webpack, typescript, eslint, prettier) is fine; framework packages (`common/*`, `runtime/*`, `compilers/*`, `platforms/*`) must stay dependency-free aside from other `@heleonix/*` workspace packages.
- Always use TypeScript.
- `README.md` is the DSL design spec (dimensions, mergeable resources, file format syntax/examples) — read it before adding or changing language features, and follow it before suggesting new features.
- Use the configured eslint, prettier, and editorconfig for formatting; validate type changes build cleanly with `tsc --noEmit`.
- Don't write comments in source code to explain implementation details.

## Additional rules — read the matching file before starting

| When you are...                                        | Read                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| adding/changing DSL syntax, file formats, or compilers | [.agents/rules/dsl-design.md](.agents/rules/dsl-design.md) |

## Skills

Repeatable procedures live in `.claude/skills/*/SKILL.md` (open Agent Skills format, not Claude-specific). Check for a matching skill before doing a task manually:

| Skill                                                                      | Use when                         |
| -------------------------------------------------------------------------- | -------------------------------- |
| [.claude/skills/add-package/SKILL.md](.claude/skills/add-package/SKILL.md) | creating a new workspace package |

## What this is

Heleonix is a from-scratch, dependency-free declarative framework for web sites/apps, built as a pnpm monorepo. It defines its own DSL with dedicated file formats compiled at build time into runtime definitions consumed by a small DI-driven runtime core.

## Commands

This is a pnpm workspace (`pnpm@10.18.1`, see `packageManager` in `package.json`). All root scripts fan out via `pnpm -r run <script>`, so a package only participates if it defines that script itself.

```sh
pnpm install                 # install workspace deps
pnpm build                   # clean + build every package (rollup or esbuild per-package)
pnpm dev                     # run dev scripts (currently only playground/hx-sandbox: webpack-dev-server)
pnpm dts                     # run api-extractor (.d.ts rollup) where present
pnpm clean                   # rimraf temp + per-package clean

# single package, by its package.json "name" (not folder name):
pnpm --filter @heleonix/hx-utils run build
pnpm --filter @heleonix/hx-sandbox run dev      # sandbox app, http://localhost:4000
pnpm --filter @heleonix/hx-language-server --filter heleonix-hx-language-server-vscode run build

# lint/format (no per-package "lint" scripts exist yet; lint from the root):
pnpm exec eslint .
pnpm exec prettier --check .
tsc --noEmit                 # validate type changes build cleanly
```

There is currently **no test runner wired up anywhere** in the repo (no per-package `test` script, no jest/vitest/jasmine config). The `testing/*` packages are placeholders for a future testing toolkit the framework will _ship to consumers_ — they are not how this repo tests itself.

### Debugging the VSCode extension / language server

`.vscode/launch.json` + `.vscode/tasks.json` define the workflow:

- **"Run Heleonix Framework Language Service"** — launches an Extension Host with `extensions/hx-language-server-vscode` against `playground/hx-sandbox` as the open workspace (runs `extension: build` task first, which builds both `hx-language-server` and `hx-language-server-vscode` via esbuild).
- **"Attach to Heleonix Framework Language Server"** — Node attach on port 6009, for stepping through the LSP server process itself.
- **"Sandbox: Launch"** — Chrome debug config that starts the sandbox dev server and opens `localhost:4000`.

## Workspace layout

`pnpm-workspace.yaml` globs: `playground/*`, `compilers/*`, `devtools/*`, `extensions/*`, `linting/*`, `platforms/*`, `plugins/*`, `runtime/*`, `common/*`, `ssr/*`, `testing/*`, `cli/*`. Package import names map to source via TS path aliases in `tools/tsconfig.paths.json` (e.g. `@heleonix/hx-core` → `runtime/hx-core/src`) — always add a new package there when wiring up cross-package imports.

Status by area (so you know what's real vs. an empty scaffold folder waiting for a package.json):

| Area                                                     | Real / implemented                                                                                                                                                                                                        | Empty placeholder                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `common/*`                                               | `hx-language` (DSL tokens/types/grammar), `hx-utils` (dependency-free utils, e.g. `Merger.mergeDeeply`)                                                                                                                   | —                                                                 |
| `compilers/*`                                            | all 6: `hx-compiler-core` (base `XmlCompiler`/`JsoncCompiler`), `-components` (`.hxm`), `-configs` (`.hxc`), `-dictionaries` (`.hxd`), `-styles` (`.hxs`), `-themes` (`.hxt`)                                             | —                                                                 |
| `runtime/*`                                              | `hx-core` (Application, DI, ComponentManager/StateManager/DictionaryManager/ConfigManager, PlatformAdapter)                                                                                                               | `hx-router` (stub export), `hx-ui` (only `Button`/`Input` so far) |
| `platforms/*`                                            | `hx-platform-web` (DOM `PlatformAdapter`/`PlatformRuntime`/`PlatformComponent` impl)                                                                                                                                      | —                                                                 |
| `plugins/*`                                              | `hx-plugin-core` (scans/compiles `.hxm/.hxd/.hxc/.hxs/.hxt`, generates virtual definition-source modules), `hx-webpack-plugin` (webpack loader+plugin on top of core)                                                     | `esbuild`, `vite`, `rollup`, `webpack`                            |
| `extensions/*`                                           | `hx-language-server` (LSP: diagnostics, indexing, reference resolution for `.hxm/.hxd/.hxc`), `hx-language-server-vscode` (VSCode client: syntax/TextMate grammars + LSP client, bundles the language server via esbuild) | `chrome`, `webstorm`                                              |
| `playground/*`                                           | `hx-sandbox` (webpack dev-server demo/playground, the de-facto integration test target)                                                                                                                                   | —                                                                 |
| `cli/*`, `devtools/*`, `testing/*`, `linting/*`, `ssr/*` | —                                                                                                                                                                                                                         | all empty (no `package.json`/`src` yet)                           |

## Architecture

**Compile → runtime pipeline.** Source `.hxm`/`.hxd`/`.hxc`/`.hxs`/`.hxt` files are compiled at build time (via `hx-plugin-core` + a bundler plugin like `hx-webpack-plugin`, which delegate to the per-format compiler packages extending `hx-compiler-core`'s `XmlCompiler`/`JsoncCompiler`) into JSON definitions (`IComponentDefinition`, `IDictionaryDefinition`, `IConfigDefinition`, `IStyleDefinition`, `IThemeDefinition` — all typed in `common/hx-language`). The bundler plugin generates virtual "definition-source" modules that `runtime/hx-core`'s managers (`ComponentManager`, `DictionaryManager`, `ConfigManager`, ...) consume at app start.

**Platform abstraction.** `runtime/hx-core` is platform-agnostic; DOM-specific behavior lives behind `PlatformAdapter`/`PlatformRuntime`/`PlatformComponent`, implemented for the web in `platforms/hx-platform-web`. New platforms (native, SSR) plug in the same way rather than touching `hx-core`.

**Dimensions and mergeable resources** (full spec in `README.md`): dictionaries, configs, styles, and themes are "mergeable" — a more specific dimensioned file (e.g. `Buttons.en-US.customer2.hxd`) overlays a less specific one rather than redefining it, using `usage: extend|override` frontmatter. `common/hx-language/src/dimensions/` (`mergeDimensions`, `selectDimensions`) and `common/hx-utils`'s `Merger.mergeDeeply` implement the merge semantics consumed by compilers/runtime.

**One-export-per-file convention.** Inside `src/` of foundational packages (`common/hx-language`, `common/hx-utils`, and generally elsewhere), each `.ts` file exports exactly one named thing matching its filename (e.g. `src/names/joinFQPropertyName.ts` exports `joinFQPropertyName`), aggregated through a single `src/index.ts` of `export * from "./..."` lines. Follow this pattern when adding new exports rather than grouping multiple exports per file.

**Package build shape.** Most library packages share one rollup setup: `rollup.config.js` calls `createRollupConfig()` from `tools/rollup.js`, emitting `dist/cjs/index.cjs`, `dist/esm/index.js`, `dist/types/*` (driven by `tsconfig.json` extending `tools/tsconfig.base.json`), plus `dts` via `api-extractor` (config extends `tools/api-extractor.base.json`). `package.json` `dependencies`/`peerDependencies` keys are auto-treated as rollup externals. The VSCode extension and language server are the exception — they build with esbuild (`esbuild.mjs`) since they bundle for a Node/VSCode host rather than publishing as a library.

**LSP architecture.** `extensions/hx-language-server` is transport-agnostic LSP server logic over `vscode-languageserver`, depending on `hx-compiler-core` + `hx-language` to parse/validate the same DSL the build pipeline compiles. `extensions/hx-language-server-vscode` is purely a thin client: TextMate grammars/language config for syntax highlighting plus wiring to launch/talk to the server — no DSL logic of its own.
