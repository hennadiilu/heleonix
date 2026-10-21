/** A finding a build reports - an error failing it, or a warning. */
export interface IBuildReport {
  level: "error" | "warning"

  code: string

  /** `CODE: message (file:line:column)`, ready for a bundler's error output. */
  text: string
}
