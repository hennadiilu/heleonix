import type { IBlockNode } from "./IBlockNode"

export interface IBlock {
  kind: "block"

  prelude: string

  /** Source offset of the prelude. */
  start: number

  nodes: IBlockNode[]

  doc?: string
}
