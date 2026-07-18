import type { FlatObjectIssueKind } from "./FlatObjectIssueKind"

/** A flatness violation with its offsets in the parsed source. */
export interface IFlatObjectIssue {
  kind: FlatObjectIssueKind

  start: number

  end: number

  /** The offending entry key, when the issue is a `nested`/`nonString` value. */
  key?: string
}
