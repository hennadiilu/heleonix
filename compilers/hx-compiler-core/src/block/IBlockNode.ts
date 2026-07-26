import type { IBlock } from "./IBlock"
import type { IBlockDeclaration } from "./IBlockDeclaration"
import type { IBlockStatement } from "./IBlockStatement"

/** One node of a parsed CSS-subset document: a block, a declaration or a statement. */
export type IBlockNode = IBlock | IBlockDeclaration | IBlockStatement
