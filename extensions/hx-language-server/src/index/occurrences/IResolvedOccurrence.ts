import { OccurrenceRole } from "./OccurrenceRole"

/** A file occurrence whose symbol identity has been resolved to a stable key. */
export interface IResolvedOccurrence {
  filePath: string

  /** Stable symbol identity (see {@link symbolKey}); occurrences sharing it are the same symbol. */
  key: string

  role: OccurrenceRole

  start: number

  end: number
}
