import { Diagnostic } from "vscode-languageserver"

export interface IDataEnvelope {
  diagnostics: Diagnostic[]

  body?: string

  bodyStart: number

  parseOk: boolean
}
