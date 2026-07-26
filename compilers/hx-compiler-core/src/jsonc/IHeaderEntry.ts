/**
 * One `key: value` declaration of a frontmatter header. `docs` is the raw
 * inner text of the `/** *\/` doc comment directly above the entry (starting
 * with `*`), parsed by consumers via `parseDocComment`.
 */
export interface IHeaderEntry {
  value: string

  docs?: string
}
