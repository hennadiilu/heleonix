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
pnpm test                    # every package's Jasmine suite, run from src (no build needed)

# single package, by its package.json "name" (not folder name):
pnpm --filter @heleonix/hx-utils run build
pnpm --filter @heleonix/hx-sandbox run dev      # sandbox app, http://localhost:4000
pnpm --filter @heleonix/hx-language-server --filter heleonix-hx-language-server-vscode run build
pnpm --filter @heleonix/hx-core run test

# lint/format (no per-package "lint" scripts exist yet; lint from the root):
pnpm exec eslint .
pnpm exec prettier --check .
tsc --noEmit                 # validate type changes build cleanly
```

Tests run on **Jasmine through tsx**, straight from source — no build, no bundle. One shared runner, `tools/runSpecs.ts`, runs every `spec/**/*.spec.ts` of the package it is started in, and each package with a suite has a `test` script of `tsx --tsconfig ../../tsconfig.json ../../tools/runSpecs.ts`; the root `pnpm test` fans out with `pnpm -r run test` and prints a per-package tally. Eleven packages have suites today — run it to see which.

**No build before testing.** tsx honours the root `tsconfig.json`, whose path mapping (`tools/tsconfig.paths.json`) sends every `@heleonix/*` import to that package's `src`, so a spec and every workspace package its subject depends on run from source, with one copy of each class. Specs import a package's public API by name (`@heleonix/hx-core`) and the implementation classes its public barrel hides by relative path into `src` (`../src/bindings/Binder`). The runner defines `DEV` the way a development build does.

Typechecking, by contrast, keeps two views that disagree on purpose:

- The **root** `tsconfig.json` also extends `tools/tsconfig.paths.json`, so `tsc --noEmit` from the repo root resolves every `@heleonix/*` to its `src`.
- A **package's own** `tsconfig.json` extends only `tools/tsconfig.base.json` (no paths), so it resolves workspace dependencies through `node_modules` to their rolled-up `dist/types/*.d.ts`.

So `pnpm --filter <pkg> exec tsc --noEmit -p tsconfig.json` is the check that matches how a package really builds, while root `tsc --noEmit` is the one that also covers specs; it reports a standing set of errors — diff against the pre-change output rather than expecting zero. Changing a package's public types means running `build` **and** `dts` before its dependents typecheck against them; the language server consuming the compilers is the case that bites most often.

tsx transpiles without typechecking, so a green test run says nothing about types — root `tsc --noEmit` is what checks specs.

The `testing/*` packages are placeholders for a future testing toolkit the framework will _ship to consumers_ — they are not how this repo tests itself.

### Debugging the VSCode extension / language server

`.vscode/launch.json` + `.vscode/tasks.json` define the workflow:

- **"Run Heleonix Framework Language Service"** — launches an Extension Host with `extensions/hx-language-server-vscode` against `playground/hx-sandbox` as the open workspace (runs `extension: build` task first, which builds both `hx-language-server` and `hx-language-server-vscode` via esbuild).
- **"Attach to Heleonix Framework Language Server"** — Node attach on port 6009, for stepping through the LSP server process itself.
- **"Sandbox: Launch"** — Chrome debug config that starts the sandbox dev server and opens `localhost:4000`.

## Workspace layout

`pnpm-workspace.yaml` globs: `playground/*`, `compilers/*`, `devtools/*`, `extensions/*`, `linting/*`, `platforms/*`, `plugins/*`, `runtime/*`, `common/*`, `ssr/*`, `testing/*`, `cli/*`. Package import names map to source via TS path aliases in `tools/tsconfig.paths.json` (e.g. `@heleonix/hx-core` → `runtime/hx-core/src`) — always add a new package there when wiring up cross-package imports.

Status by area (so you know what's real vs. an empty scaffold folder waiting for a package.json):

| Area                                                     | Real / implemented                                                                                                                                                                                                                                                                                 | Empty placeholder                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `common/*`                                               | `hx-language` (DSL tokens/types/grammar), `hx-utils` (dependency-free utils, e.g. `Merger.mergeDeeply`)                                                                                                                                                                                            | —                                                                 |
| `compilers/*`                                            | all 6: `hx-compiler-core` (base `XmlCompiler`/`JsoncCompiler`), `-components` (`.hxm`), `-configs` (`.hxc`), `-dictionaries` (`.hxd`), `-styles` (`.hxs`), `-themes` (`.hxt`)                                                                                                                      | —                                                                 |
| `runtime/*`                                              | `hx-core` (Application, ComponentManager/StateManager/StyleManager/ThemeManager, ApplicationRuntime + driver interfaces, IScheduler)                                                                                                                                                               | `hx-router` (stub export), `hx-ui` (only `Button`/`Input` so far) |
| `platforms/*`                                            | `hx-platform-web` (DOM `WebApplicationRuntime` + `WebScheduler`/`WebComponentDriver`/`WebThemeDriver`/`WebStyleDriver`/`WebPlatformComponent`), `hx-platform-ssr` (server string-rendering of the styling seams: `SsrStyleDriver`/`SsrStyleEffect`, reuses web CSS composers for hydration parity) | —                                                                 |
| `plugins/*`                                              | `hx-plugin-core` (scans/compiles `.hxm/.hxd/.hxc/.hxs/.hxt`, generates virtual definition-source modules), `hx-webpack-plugin` (webpack loader+plugin on top of core)                                                                                                                              | `esbuild`, `vite`, `rollup`, `webpack`                            |
| `extensions/*`                                           | `hx-language-server` (LSP: diagnostics, indexing, reference resolution for `.hxm/.hxd/.hxc`), `hx-language-server-vscode` (VSCode client: syntax/TextMate grammars + LSP client, bundles the language server via esbuild)                                                                          | `chrome`, `webstorm`                                              |
| `playground/*`                                           | `hx-sandbox` (webpack dev-server demo/playground, the de-facto integration test target)                                                                                                                                                                                                            | —                                                                 |
| `cli/*`, `devtools/*`, `testing/*`, `linting/*`, `ssr/*` | —                                                                                                                                                                                                                                                                                                  | all empty (no `package.json`/`src` yet)                           |

## Architecture

**Compile → runtime pipeline.** Source `.hxm`/`.hxd`/`.hxc`/`.hxs`/`.hxt` files are compiled at build time (via `hx-plugin-core` + a bundler plugin like `hx-webpack-plugin`, which delegate to the per-format compiler packages extending `hx-compiler-core`'s `XmlCompiler`/`JsoncCompiler`) into JSON definitions (`IComponentDefinition`, `IDictionaryDefinition`, `IConfigDefinition`, `IStyleDefinition`, `IThemeDefinition` — all typed in `common/hx-language`). The bundler plugin generates virtual "definition-source" modules that `runtime/hx-core`'s definition loaders (`ComponentDefinitionLoader`, `DictionaryDefinitionLoader`, `ConfigDefinitionLoader`, ...) consume at app start.

**Platform abstraction.** `runtime/hx-core` is platform-agnostic. An `ApplicationRuntime` is the one entity an application is bootstrapped with - one per `Application`, never shared, which is what keeps several applications on a page independent. (The term _platform_ is deliberately unspent, reserved for a future shared page-wide layer above the per-application runtimes.) Every platform-specific behavior is a narrow _driver_ interface the runtime exposes: `IComponentDriver` (root-host resolution), `IThemeDriver` (token/artifact publication), `IStyleDriver` (style composition + per-instance `IStyleEffect`), plus an `IScheduler` (hx-core declares only the interface; `WebScheduler` implements the whole two-phase queue, since batching is platform-shaped) and the `start()`/`stop()` lifecycle. `componentDefinition`, `dictionaryDefinition` and `configDefinition` are optional in `IApplicationBootstrap`, and an absent section builds no provider at all - the application simply has no components / no dictionaries / no configs (a `dictionary`/`config` binding then resolves to `undefined`, since its `IValueSource` is never registered). Without component definitions the application is headless: no root host, no component tree, and not even the framework/runtime component sources, though its runtime still implements the full driver surface (the drivers stay abstract). No core service is handed to a platform: what a platform reacts to reaches it through its own drivers and components - a `PlatformComponent` learns from `IBinder` which of its property paths bindings reach it by, so per-property host machinery (a DOM listener) is owned by the component itself. The core keeps all policy - lifecycle, caching, refcounting, subscriptions - so a new platform implements primitives only, never re-implements the managers. Implemented for the web in `platforms/hx-platform-web`.

**Dimensions and mergeable resources** (full spec in `README.md`): dictionaries, configs, styles, and themes are "mergeable" — a more specific dimensioned file (e.g. `Buttons.en-US.customer2.hxd`) overlays a less specific one rather than redefining it, using `usage: extend|override` frontmatter. `common/hx-language/src/dimensions/` (`mergeDimensions`, `selectByDimensions`) and `common/hx-utils`'s `Merger.mergeDeeply` implement the merge semantics consumed by compilers/runtime.

**One-export-per-file convention.** Inside `src/` of foundational packages (`common/hx-language`, `common/hx-utils`, and generally elsewhere), each `.ts` file exports exactly one named thing matching its filename (e.g. `src/names/joinFQPropertyName.ts` exports `joinFQPropertyName`), aggregated through a single `src/index.ts` of `export * from "./..."` lines. Follow this pattern when adding new exports rather than grouping multiple exports per file.

**Package build shape.** Most library packages share one rollup setup: `rollup.config.js` calls `createRollupConfig()` from `tools/rollup.js`, emitting `dist/cjs/index.cjs`, `dist/esm/index.js`, `dist/types/*` (driven by `tsconfig.json` extending `tools/tsconfig.base.json`), plus `dts` via `api-extractor` (config extends `tools/api-extractor.base.json`). `package.json` `dependencies`/`peerDependencies` keys are auto-treated as rollup externals. The VSCode extension and language server are the exception — they build with esbuild (`esbuild.mjs`) since they bundle for a Node/VSCode host rather than publishing as a library.

**LSP architecture.** `extensions/hx-language-server` is transport-agnostic LSP server logic over `vscode-languageserver`, depending on `hx-compiler-core` + `hx-language` to parse/validate the same DSL the build pipeline compiles. `extensions/hx-language-server-vscode` is purely a thin client: TextMate grammars/language config for syntax highlighting plus wiring to launch/talk to the server — no DSL logic of its own.
