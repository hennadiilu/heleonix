declare const eventRefBrand: unique symbol

/**
 * Branded argument type for a style qualifier: the argument's value addresses a
 * component event (as in `*.hxm` event bindings). The analyzer detects the
 * brand and routes value completion/validation to the component's events.
 *
 * Type-only marker - authored in a qualifier's args interface, never
 * instantiated; the compiled rule key keeps the source text verbatim.
 */
export type EventRef = string & { readonly [eventRefBrand]: "EventRef" }
