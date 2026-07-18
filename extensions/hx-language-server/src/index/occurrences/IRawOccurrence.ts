import { IPropertyBase } from "./IPropertyBase"
import { OccurrenceRole } from "./OccurrenceRole"

/**
 * A located, not-yet-resolved use of a symbol found while scanning one file.
 * Offsets are absolute within that file's source. Symbol identity is finalized
 * later by {@link OccurrenceIndex} - for `property` occurrences that means
 * resolving {@link IPropertyBase} and the named-control `prefix` against the
 * merged index, which is only available once every file has been scanned.
 */
export type IRawOccurrence =
  | { kind: "component"; role: OccurrenceRole; name: string; start: number; end: number }
  | { kind: "dictionaryEntry"; role: OccurrenceRole; name: string; entry: string; start: number; end: number }
  | { kind: "configEntry"; role: OccurrenceRole; name: string; entry: string; start: number; end: number }
  | {
      kind: "property"
      role: OccurrenceRole
      base: IPropertyBase
      /** Named-control navigation before the first `:` (empty for the component's own property). */
      prefix: string
      /** Head identifier of the property path - the part matched against a component's property pool. */
      head: string
      start: number
      end: number
    }
