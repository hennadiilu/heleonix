/**
 * A platform-neutral piece of a rule's condition, returned by a qualifier's
 * `build`. Payloads carry no CSS punctuation - the platform maps them to its own
 * mechanism (web: `pseudo` -> `:hover`/`::before`, `environment` -> `@media`,
 * `gate` -> `[data-hx-<id>]`; `marker` means the rule applies unconditionally
 * under its signature). Composing fragments into a concrete selector is the
 * platform's job, never the core's.
 */
export type StyleFragment =
  | { readonly pseudo: string }
  | { readonly environment: string }
  | { readonly gate: string }
  | { readonly marker: true }
