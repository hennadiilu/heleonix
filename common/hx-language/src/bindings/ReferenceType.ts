import type { BindingType } from "./BindingType"

/**
 * Named-definition reference kinds addressed as `Prefix Name.entry` and resolved
 * through the workspace reference index: `dictionary` (`@`) and `config` (`#`).
 * `theme` is excluded - it is a binding source too, but `{$...}` tokens resolve
 * against the singular theme token space (a separate index), not named
 * definitions, so it never joins this registry.
 */
export type ReferenceType = Exclude<BindingType, "state" | "literal" | "theme">
