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
   * Emits each source's doc comments as a standalone `.docs.json` sidecar asset (an
   * `IDocsManifest`), 1-to-1 with the emitted definition `.json` - the tooling-facing
   * docs output consumed via the package `exports` `hxdocs` condition (e.g.
   * `"./components/*": { "hxm": "./dist/components/*.hxm.json", "hxdocs":
   * "./dist/components/*.hxm.docs.json" }`). Sources without doc comments emit no
   * sidecar. `true` names sidecars after the definition asset with `.json` replaced by
   * `.docs.json` (`src/Button.hxm.json` -> `src/Button.hxm.docs.json`, following
   * `emitJson`'s naming); pass a function returning a path relative to `output.path`
   * to customize. Docs never enter the app bundle - this is emission-only.
   */
  emitDocs?: boolean | ((file: IAssetFile) => string)
  /**
   * Additionally bundles every source's doc comments into one docs manifest asset (an
   * `IDocsManifest` with `package`/`version` from the package.json at the compiler
   * context) for documentation portals and single-artifact consumers. `true` emits
   * `hx.docs.json` in `output.path`; a string sets the asset path. Independent of
   * `emitDocs` - ship sidecars, the bundle, or both.
   */
  emitDocsBundle?: boolean | string
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
