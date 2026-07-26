import type { IBlockNode } from "./IBlockNode"

/** Result of parsing a CSS-subset (`*.hxs`/`*.hxt`) body: its top-level nodes. */
export interface IBlockDocument {
  nodes: IBlockNode[]
}
