import { DiagnosticSeverity } from "vscode-languageserver"

export interface ILanguageServerSettings {
  exclude: string[]

  diagnosticsEnabled: boolean

  unknownReferenceSeverity: DiagnosticSeverity | undefined

  unusedEntrySeverity: DiagnosticSeverity | undefined

  definitionSources: string[]
}
