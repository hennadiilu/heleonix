import type { DiagnosticSeverity } from "./DiagnosticSeverity"

export interface IDiagnostic {
  code: string

  severity: DiagnosticSeverity

  message: string

  file: string

  subject?: string
}
