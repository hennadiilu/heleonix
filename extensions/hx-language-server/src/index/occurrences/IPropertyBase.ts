/**
 * The component(s) a property occurrence is anchored to, before any named-control
 * navigation prefix is applied. Resolution to concrete component names happens at
 * index time (it needs the merged {@link DefinitionIndex}):
 *
 *   - `components`          : an explicit set - the tag being used (attribute names)
 *                            or the file's own component(s) (bare state reads).
 *   - `dictionaryReferrers` : the components that reference `name.entry` of a
 *                            dictionary - the pool an interpolated `{param}` inside
 *                            that entry resolves against.
 */
export type IPropertyBase =
  | { source: "components"; components: string[] }
  | { source: "dictionaryReferrers"; name: string; entry: string }
