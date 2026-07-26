declare const propertyRefBrand: unique symbol

/**
 * Branded argument type for a style qualifier: the argument's value is a
 * `{...}` binding source addressing a component property / state path (the same
 * `ctrl.path:prop` addressing as `*.hxm`). The analyzer detects the brand and
 * routes value completion/validation to the component state pool.
 *
 * Type-only marker - authored in a qualifier's args interface, never
 * instantiated; the compiled rule key keeps the source text verbatim.
 */
export type PropertyRef = string & { readonly [propertyRefBrand]: "PropertyRef" }
