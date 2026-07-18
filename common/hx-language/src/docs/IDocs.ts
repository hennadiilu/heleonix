/**
 * Structured documentation parsed from a doc comment (`<!--* ... -->` in XML
 * formats, `/** ... *\/` in JSONC formats). All text fields are markdown.
 *
 * `props`/`params` come from `@prop`/`@param` block tags; `entries` is
 * assembled by the per-format compilers for formats documented per entry
 * (dictionary/config entries, theme design tokens) and is keyed by the entry
 * key or the dot-joined token path.
 */
export interface IDocs {
  summary?: string

  deprecated?: string

  examples?: string[]

  see?: string[]

  props?: Record<string, string>

  params?: Record<string, string>

  entries?: Record<string, IDocs>
}
