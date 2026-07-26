/**
 * Where a theme token is defined, for `{$...}` go-to-definition. Only workspace
 * `*.hxt` partials carry a location; tokens delivered through a dependency's
 * `hx.meta.json` have no local source and are absent.
 */
export interface IThemeTokenLocation {
  file: string

  line: number

  character: number

  length: number
}
