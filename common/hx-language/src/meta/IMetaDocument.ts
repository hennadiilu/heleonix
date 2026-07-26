import type { IComponentMetaEntry } from "./IComponentMetaEntry"
import type { IRegistryMetaEntry } from "./IRegistryMetaEntry"
import type { IDocsEntry } from "../docs/IDocsEntry"
import type { IQualifierDefinition } from "../qualifiers/IQualifierDefinition"

/**
 * A package's compiled metadata manifest (`hx.meta.json`): one bundle per
 * package under the `hxmeta` export condition - never a runtime payload.
 * Every section is optional; consumers read the facets they understand.
 */
export interface IMetaDocument {
  schemaVersion: number

  package?: string

  version?: string

  /** Documentation of all kinds, keyed inside entries by kind + name + dimension. */
  docs?: IDocsEntry[]

  /** Component contracts (typings frontmatter facts). */
  components?: IComponentMetaEntry[]

  /** Converter contracts (name + resolved params) from discovered TS classes. */
  converters?: IRegistryMetaEntry[]

  /** Action contracts (name + resolved params) from discovered TS classes. */
  actions?: IRegistryMetaEntry[]

  /**
   * The package's contribution to the theme token space: `{$...}`-addressable
   * dot-path -> leaf value (aliases/interpolations kept verbatim). Merged from
   * the package's `*.hxt` partials; a consumer indexes them for `{$...}`
   * completion/hover/validation without re-reading the sources.
   */
  themeTokens?: Record<string, string>

  /** Style-qualifier contracts (name + resolved arg members incl. ref-kind) from discovered TS classes. */
  qualifiers?: IQualifierDefinition[]
}
