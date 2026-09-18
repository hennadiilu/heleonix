import type { FlatObjectIssueKind } from "./FlatObjectIssueKind"

export interface IFlatObjectIssue {
  kind: FlatObjectIssueKind

  start: number

  end: number

  key?: string
}
