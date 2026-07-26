import type { DiagnosticSeverity } from "./DiagnosticSeverity"

/**
 * One analyzer finding. Diagnostics are the analyzer's public API: stable
 * codes, one severity policy, identical results in builds and editors.
 */
export interface IDiagnostic {
  code: string

  severity: DiagnosticSeverity

  message: string

  file: string

  /**
   * The exact source spelling of the offending token (`%ButtonVariants.x`,
   * `@Buttons.save`, a tag name), so position-less findings can be mapped to
   * ranges by hosts that hold the source text.
   */
  subject?: string
}
