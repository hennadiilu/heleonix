import { IRawOccurrence } from "./IRawOccurrence"

/**
 * Every symbol occurrence found in one file, plus the line-start offsets needed
 * to turn an absolute offset back into an LSP position without re-reading the
 * file. Produced by {@link collectOccurrences} and aggregated by
 * {@link OccurrenceIndex}.
 */
export interface IFileOccurrences {
  /** Absolute filesystem path (the same key the registry indexes the file under). */
  filePath: string

  lineStarts: number[]

  raw: IRawOccurrence[]
}
