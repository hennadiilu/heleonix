import { IPropertyBase } from "./IPropertyBase"
import { OccurrenceRole } from "./OccurrenceRole"

export type IRawOccurrence =
  | { kind: "component"; role: OccurrenceRole; name: string; start: number; end: number }
  | { kind: "dictionaryEntry"; role: OccurrenceRole; name: string; entry: string; start: number; end: number }
  | { kind: "configEntry"; role: OccurrenceRole; name: string; entry: string; start: number; end: number }
  | {
      kind: "property"
      role: OccurrenceRole
      base: IPropertyBase
      prefix: string
      head: string
      start: number
      end: number
    }
