import { DiagnosticSeverity } from "vscode-languageserver"
import { DefinitionIndex } from "../index/DefinitionIndex"

/** Per-request inputs handed to a language service. */
export interface ILanguageContext {
  index: DefinitionIndex

  /** Severity for unresolved dictionary/config references; `undefined` disables the check. */
  unknownReferenceSeverity: DiagnosticSeverity | undefined

  /** Severity for dictionary/config entry keys referenced nowhere; `undefined` disables the check. */
  unusedEntrySeverity: DiagnosticSeverity | undefined
}
