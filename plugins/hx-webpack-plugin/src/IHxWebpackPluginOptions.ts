import type { IDimensionDefinition } from "@heleonix/hx-language"
import type { Kind } from "@heleonix/hx-language"
import type { IAssetFile } from "@heleonix/hx-plugin-core"
import { IHxDefinitionSourceOptions } from "./IHxDefinitionSourceOptions"
import { IHxEmitDefinitionSourcesOptions } from "./IHxEmitDefinitionSourcesOptions"

export interface IHxWebpackPluginOptions {
  /** Dimension definitions - same shape the runtime DimensionManager receives. */
  dimensions?: readonly IDimensionDefinition[]
  /** Directories to scan for sources. Absolute, or relative to the compiler context. */
  include?: string | string[]
  /**
   * Directories to skip while scanning. Each entry is either a bare folder name
   * (skipped anywhere in the tree, e.g. `"node_modules"`) or a folder path
   * (absolute, or relative to the compiler context). Defaults to `"node_modules"`.
   */
  exclude?: string | string[]
  /** Source kinds to scan and generate. Defaults to all supported kinds. */
  kinds?: readonly Kind[]
  /** Per-kind overrides for the generated class name and module specifier. */
  sources?: Partial<Record<Kind, IHxDefinitionSourceOptions>>
  /**
   * When set, a TypeScript declaration file typing the generated modules is written
   * to this path (absolute, or relative to the compiler context) and kept in sync with
   * the configuration. Reference it from your `tsconfig.json`; it is meant to be
   * git-ignored and regenerated on build.
   */
  declarationFile?: string
  /**
   * How generated definition sources load compiled definitions. `"eager"` (default)
   * imports every definition statically, bundling them with the generated module.
   * `"lazy"` puts each definition behind a dynamic `import()` so webpack code-splits
   * them - one chunk per definition by default, or grouped via `chunkName` - and a
   * definition is only loaded when `getDefinitions` first requests its name.
   */
  loading?: "eager" | "lazy"
  /**
   * With `loading: "lazy"`, names the chunk an asset belongs to (emitted as a
   * `webpackChunkName` magic comment). Assets mapped to the same name share one chunk;
   * return `undefined` to keep webpack's default per-import chunk for that asset.
   */
  chunkName?: (file: IAssetFile) => string | undefined
  /**
   * Emits each compiled definition as a standalone `.json` asset in `output.path`,
   * 1-to-1 with its `.hxm`/`.hxd`/`.hxc`/`.hxs`/`.hxt` source - the library-mode output
   * consumed via package `exports` (e.g. `"./components/*": { "hxm":
   * "./dist/components/*.hxm.json" }`) or fetched directly. Emission happens in the
   * plugin from the scanned sources, so every non-skipped source is emitted whether or
   * not anything imports it. `true` names assets after the source path relative to the
   * compiler context with `.json` appended (`src/Button.en-US.hxm` ->
   * `src/Button.en-US.hxm.json`; a source outside the context falls back to its file
   * name), so same-named sources of different kinds never collide; pass a function
   * returning a path relative to `output.path` to customize - e.g. per-kind folders or
   * flattening.
   */
  emitJson?: boolean | ((file: IAssetFile) => string)
  /**
   * Emits the package's compile-time metadata manifest (an `IMetaDocument`): one
   * bundle per package - no per-file sidecars - carrying doc comments of every
   * kind and component/converter typings-frontmatter facts, with
   * `package`/`version` from the package.json at the compiler context. Shipped
   * under the package `exports` `hxmeta` condition; consumed by build validation,
   * editors and docs generation - never a runtime payload. `true` emits
   * `hx.meta.json` in `output.path`; a string sets the asset path.
   */
  emitMeta?: boolean | string
  /**
   * Runs the shared `@heleonix/hx-analyzer` over the scanned sources (including
   * component-header params) after compilation: cross-file reference resolution and
   * contract validation with the same diagnostic codes editors show, reported
   * as webpack errors/warnings. The analyzer instance persists across watch
   * rebuilds and recompiles only changed files. Per-file compile errors of
   * kind sources are reported by the loader already, so the analyzer's
   * duplicates of those are suppressed. `failOnWarnings` promotes analyzer
   * warnings to build errors (CI-style strictness).
   */
  validate?: boolean | { failOnWarnings?: boolean }
  /**
   * Emits one plain (unbundled) ES module per kind that extends the kind's runtime
   * definition-source class and imports the emitted `.json` assets by relative path -
   * eagerly or via dynamic `import()` per `loading` - plus a barrel re-exporting all of
   * them. This is the publishable "library mode" output: the imports stay intact in the
   * emitted files, so the consuming application's bundler decides how the definitions
   * load (inlined, per-file async, grouped chunks). Each module (and the barrel) gets a
   * sibling `.d.ts` typing its exported class for TypeScript consumers. Implies
   * `emitJson` (the modules are meaningless without the files they import). Class/diName defaults derive from the
   * `name` in the package.json at the compiler context (e.g. `@acme/ui` ->
   * `AcmeUiComponentDefinitionSource`) so sources from different libraries can be
   * registered together; setting `sources[kind].className` overrides this.
   */
  emitDefinitionSources?: boolean | IHxEmitDefinitionSourcesOptions
}
