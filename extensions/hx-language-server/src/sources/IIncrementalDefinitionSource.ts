import { IDefinitionSource } from "./IDefinitionSource"
import { IIndexContribution } from "../index/IIndexContribution"

/**
 * A definition source that supports per-file indexing, so the registry can
 * update a single file's contribution on change/create/delete instead of
 * re-scanning everything. The workspace source implements this.
 */
export interface IIncrementalDefinitionSource extends IDefinitionSource {
  /** Recursively index every matching file, keyed by absolute path. */
  scanFiles(): Promise<Map<string, IIndexContribution>>

  /** Whether this source is responsible for the given file path. */
  handles(filePath: string): boolean

  /** Index a single file, using `text` when provided (open document) or reading from disk. */
  indexFile(filePath: string, text?: string): Promise<IIndexContribution>
}
