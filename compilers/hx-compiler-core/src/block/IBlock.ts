import type { IBlockNode } from "./IBlockNode"

export interface IBlock {
  kind: "block"

  prelude: string

  nodes: IBlockNode[]

  doc?: string
}
