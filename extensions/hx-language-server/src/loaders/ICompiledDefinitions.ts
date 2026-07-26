import {
  IComponentDefinition,
  IConfigDefinition,
  IDictionaryDefinition,
  IDocsEntry,
  IMetaDocument,
} from "@heleonix/hx-language"

/**
 * The public artifact a {@link CompiledDefinitionSource} consumes: the compiled
 * definitions a package/endpoint ships, exactly as emitted by the compilers
 * (`@heleonix/hx-language`'s `I*Definition` shapes). End users never author the
 * internal {@link IIndexContribution} - they point a definition source at one of
 * these manifests, and {@link projectCompiledDefinitions} derives the index from
 * it.
 *
 * All fields are optional so a manifest can ship only the kinds it has; unknown
 * or malformed entries are ignored during projection. Dictionaries and configs
 * are kept in separate arrays because their compiled shapes are structurally
 * identical and could not otherwise be told apart.
 *
 * `docs` carries the docs sidecars/bundle a source ships (the `hxdocs` export
 * condition, or embedded directly in a manifest); entries are joined to their
 * definitions by kind + name during projection.
 */
export interface ICompiledDefinitions {
  components?: IComponentDefinition[]

  dictionaries?: IDictionaryDefinition[]

  configs?: IConfigDefinition[]

  docs?: IDocsEntry[]

  /**
   * The type-level `hx.meta.json` manifests the source ships (resolved
   * props/events/controls, converters, actions, theme tokens, qualifiers). Fed
   * to the analyzer so a definition from any provenance - package, `http(s)`
   * endpoint, custom loader - validates like a workspace one.
   */
  metas?: IMetaDocument[]
}
