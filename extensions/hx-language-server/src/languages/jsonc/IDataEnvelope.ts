import { Diagnostic } from "vscode-languageserver"

/** Common `*.hxd`/`*.hxc` envelope: frontmatter split, `usage` value, JSONC body parse. */
export interface IDataEnvelope {
  diagnostics: Diagnostic[]

  /** Document body after the frontmatter (undefined when the frontmatter is malformed). */
  body?: string

  /** Absolute offset where `body` begins. */
  bodyStart: number

  /** Whether the JSONC body parsed cleanly. */
  parseOk: boolean
}
