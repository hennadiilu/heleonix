import type { Kind } from "@heleonix/hx-language"

export interface IHxEmitDefinitionSourcesOptions {
  /**
   * Path (relative to `output.path`) of the emitted definition-source module for a
   * kind. Defaults to `<moduleName>.js` using the kind's configured/default
   * `sources[kind].moduleName`, e.g. `hx-compiled-components.js`.
   */
  fileName?: (kind: Kind) => string
  /**
   * Path (relative to `output.path`) of an emitted barrel module re-exporting every
   * kind's definition-source class - the natural target of the package's `"."` export.
   * Defaults to `"definitionsource.js"`; pass `false` to skip the barrel.
   */
  barrelFileName?: string | false
  /**
   * Appends `with { type: "json" }` import attributes to the generated `.json` imports.
   * Required for the emitted modules to run directly in Node (SSR); modern bundlers
   * accept the attributes, but older ones fail to parse them. Off by default.
   */
  jsonImportAttributes?: boolean
}
