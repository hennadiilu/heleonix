import type { IBlockNode } from "./IBlockNode"

/**
 * A `prelude { ... }` block in the CSS-subset grammar shared by `*.hxs` and
 * `*.hxt`. The `prelude` is the raw text before `{`, trimmed but otherwise
 * verbatim (`:hover`, `@media (max-width: {$Breakpoints.mobile})`, `Colors`,
 * `from, to`, `50%`) - interpreting it into a signature or group name is the
 * per-format compiler's job. Interpolations inside the prelude are preserved.
 */
export interface IBlock {
  kind: "block"

  prelude: string

  nodes: IBlockNode[]

  /** Raw `/** ... *\/` doc comment immediately preceding the block, if any. */
  doc?: string
}
