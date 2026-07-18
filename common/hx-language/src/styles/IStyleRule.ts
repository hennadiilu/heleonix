/**
 * Generic style rule - matches each `*.hxs` element verbatim while keeping
 * the structure JSON-serializable. The final shape will be refined when the
 * style runtime is implemented.
 */
export interface IStyleRule {
  tag: string

  attributes: Record<string, string>

  children?: IStyleRule[]
}
