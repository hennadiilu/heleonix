import { OccurrenceRole } from "./OccurrenceRole"

export interface IResolvedOccurrence {
  filePath: string

  key: string

  role: OccurrenceRole

  start: number

  end: number
}
