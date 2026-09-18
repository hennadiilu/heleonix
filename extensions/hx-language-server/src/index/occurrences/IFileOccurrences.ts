import { IRawOccurrence } from "./IRawOccurrence"

export interface IFileOccurrences {
  filePath: string

  lineStarts: number[]

  raw: IRawOccurrence[]
}
