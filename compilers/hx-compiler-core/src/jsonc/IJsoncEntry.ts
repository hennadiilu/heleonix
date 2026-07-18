/**
 * A top-level `"key": value` entry of a JSONC root object, with the source
 * offsets of its key and value. Collected by {@link parseJsonc} so tooling (the
 * language server) can map a position back to the entry it belongs to without
 * re-walking the source; the build path ({@link JsoncParser}) ignores it.
 */
export interface IJsoncEntry {
  key: string

  /** Offset of the key's opening quote. */
  keyStart: number

  /** Offset just past the key's closing quote. */
  keyEnd: number

  /** Offset of the value's first character. */
  valueStart: number

  /** Offset just past the value's last character. */
  valueEnd: number
}
