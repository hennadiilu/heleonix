// How a diagnostic is reported: builds fail on `error`, report `warning`, and
// leave `information` and `hint` to editors; `off` silences it everywhere.
export type DiagnosticLevel = "error" | "warning" | "information" | "hint" | "off"
