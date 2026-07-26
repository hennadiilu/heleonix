import type { IHeaderBlock } from "./IHeaderBlock"

/**
 * Result of splitting a source file into its optional frontmatter header and
 * the remaining body.
 */
export interface IFrontmatterDocument {
  /**
   * Top-level scalar `key: value` pairs of the leading `--- ... ---` header
   * (`usage: extend`). Empty when the source has no frontmatter.
   */
  frontmatter: Record<string, string>

  /**
   * Raw inner text of an attached `/** *\/` doc comment above a top-level
   * entry, keyed by that entry's key.
   */
  frontmatterDocs?: Record<string, string>

  /**
   * Source remaining after the frontmatter block (the document body).
   */
  body: string

  /**
   * Raw inner text of the file-level `/** *\/` summary comment (starting with
   * `*`), parsed by consumers via `parseDocComment`.
   */
  docs?: string

  /**
   * Named declaration blocks (`props { ... }`). Blocks do not nest.
   */
  blocks?: Record<string, IHeaderBlock>

  /**
   * Raw TypeScript type text of the typing keys (`props:`, `events:`,
   * `params:`), captured verbatim - a type name (`props: ButtonProps`) or an
   * inline type literal (`props: { … }`). The DSL never parses this; the
   * analyzer hands it to the TypeScript compiler.
   */
  types?: Record<string, string>
}
