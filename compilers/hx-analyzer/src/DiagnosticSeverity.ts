/**
 * Severity policy lives inside the analyzer, not in hosts: unresolved
 * references are errors; advisory facts (shapes, inference) produce warnings.
 */
export type DiagnosticSeverity = "error" | "warning"
