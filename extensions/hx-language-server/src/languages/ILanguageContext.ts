import { DiagnosticSeverity } from "vscode-languageserver"
import { DefinitionIndex } from "../index/DefinitionIndex"
import type { IAnalyzerSnapshot } from "../analysis/IAnalyzerSnapshot"

export interface ILanguageContext extends IAnalyzerSnapshot {
  index: DefinitionIndex

  unknownReferenceSeverity: DiagnosticSeverity | undefined

  unusedEntrySeverity: DiagnosticSeverity | undefined
}
