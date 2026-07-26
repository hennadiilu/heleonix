/**
 * Compile-time facts of a component's typings frontmatter. `props`/`events`/
 * `params` are raw TypeScript type text (a type name or an inline `{ … }`
 * literal), resolved and checked by the analyzer through the TypeScript
 * compiler - never part of the runtime definition. `docs` is the raw inner
 * text of the component's summary doc comment.
 */
export interface IComponentHeader {
  docs?: string

  props?: string

  events?: string

  params?: string
}
