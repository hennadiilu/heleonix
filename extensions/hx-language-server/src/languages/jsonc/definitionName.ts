/**
 * The definition name a `*.hxd`/`*.hxc` document contributes to the index: the
 * file's base name without its extension or dimension suffixes (e.g.
 * `Buttons.en-US.customer2.hxd` -> `Buttons`). Mirrors the `baseName` rule in
 * {@link WorkspaceDefinitionSource} so diagnostics resolve against the same key
 * the index is built under.
 */
export function definitionName(uri: string): string {
  const lastSlash = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"))
  const file = lastSlash >= 0 ? uri.slice(lastSlash + 1) : uri

  return decodeURIComponent(file).split(".")[0]
}
