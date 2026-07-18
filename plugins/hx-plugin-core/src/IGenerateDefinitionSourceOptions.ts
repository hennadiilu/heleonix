import type { IAssetFile } from "./IAssetFile"

export interface IGenerateDefinitionSourceOptions {
  /**
   * How the generated definition-source class obtains compiled definitions:
   * - `"eager"` (default): every definition is statically imported, so all of them ship
   *   in whatever chunk contains the generated module and `getDefinitions` resolves from
   *   memory.
   * - `"lazy"`: each definition sits behind a per-file dynamic `import()`, loaded on
   *   first request. How those imports materialize on disk (one file each, grouped
   *   chunks, inlined back into the bundle) is decided by the bundler's configuration -
   *   e.g. magic comments/`splitChunks` in webpack, `preserveModules`/
   *   `output.manualChunks`/`output.inlineDynamicImports` in rollup, `splitting` in
   *   esbuild.
   */
  loading?: "eager" | "lazy"
  /**
   * Builds the module specifier the generated code imports for an asset. Defaults to
   * the asset's absolute path plus the encoded meta query produced by
   * {@link encodeAssetMeta}, which suits loader-based bundlers that compile sources on
   * the fly. Bundler plugins with other conventions (virtual module ids, relative paths
   * to emitted files) supply their own builder.
   */
  request?: (file: IAssetFile) => string
  /**
   * Lazy loading only: returns the chunk name an asset belongs to, emitted as a
   * `webpackChunkName` magic comment inside the dynamic import. Assets mapped to the
   * same name are grouped into one chunk by webpack; bundlers that don't understand
   * magic comments ignore them. Return `undefined` to keep the bundler's default
   * per-import behavior for that asset.
   */
  chunkName?: (file: IAssetFile) => string | undefined
  /**
   * Appends `with { type: "json" }` import attributes to the generated imports (static
   * and dynamic). Required for the generated module to run directly in Node (SSR)
   * when it imports `.json` files; modern bundlers accept the attributes, but older
   * ones fail to parse them, so this is off by default.
   */
  importAttributes?: boolean
}
