import type { IHeaderEntry } from "./IHeaderEntry"

/** A named `name { ... }` block of a frontmatter header. Blocks do not nest. */
export interface IHeaderBlock {
  entries: Record<string, IHeaderEntry>

  /**
   * Raw inner text of the `/** *\/` doc comment directly above the block
   * (starting with `*`), parsed by consumers via `parseDocComment`.
   */
  docs?: string
}
