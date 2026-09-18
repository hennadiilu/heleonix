import type { IFlatObjectIssue } from "./IFlatObjectIssue"
import type { IJsoncComment } from "./IJsoncComment"
import type { IJsoncEntry } from "./IJsoncEntry"

export interface IJsoncParseResult {
  value: unknown

  issues: IFlatObjectIssue[]

  entries: IJsoncEntry[]

  comments: IJsoncComment[]

  rootStart: number
}
