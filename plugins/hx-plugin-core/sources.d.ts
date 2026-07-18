/**
 * Ambient module declarations for direct imports of Heleonix source files.
 *
 * A bundler integration (e.g. the `@heleonix/hx-webpack-plugin` loader) turns each
 * source file into a module whose default export is its compiled definition. This
 * file gives those imports the right TypeScript types; it does NOT produce the value
 * - the bundler still has to be configured to compile the sources.
 *
 * Opt in by referencing it once in your project, e.g.:
 *
 *   /// <reference types="@heleonix/hx-plugin-core/sources" />
 *
 * or by adding "@heleonix/hx-plugin-core/sources" to `compilerOptions.types`.
 *
 * Types are referenced inline (rather than via a top-level `import`) so this file
 * stays a global script; otherwise the `declare module "*.hx*"` wildcards would be
 * scoped as module augmentations and would not match source imports.
 */
declare module "*.hxm" {
  const definition: import("@heleonix/hx-language").IComponentDefinition
  export default definition
}

declare module "*.hxd" {
  const definition: import("@heleonix/hx-language").IDictionaryDefinition
  export default definition
}

declare module "*.hxc" {
  const definition: import("@heleonix/hx-language").IConfigDefinition
  export default definition
}

declare module "*.hxs" {
  const definition: import("@heleonix/hx-language").IStyleDefinition
  export default definition
}

declare module "*.hxt" {
  const definition: import("@heleonix/hx-language").IThemeDefinition
  export default definition
}
