import type { IHeaderEntry } from "./IHeaderEntry"

export interface IHeaderBlock {
  entries: Record<string, IHeaderEntry>

  docs?: string
}
