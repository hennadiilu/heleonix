import { DiagnosticSeverity } from "vscode-languageserver"

export interface ILanguageServerSettings {
  exclude: string[]

  diagnosticsEnabled: boolean

  /** Severity for unresolved dictionary/config references; `undefined` disables the check. */
  unknownReferenceSeverity: DiagnosticSeverity | undefined

  /** Severity for dictionary/config entry keys referenced nowhere; `undefined` disables the check. */
  unusedEntrySeverity: DiagnosticSeverity | undefined

  /**
   * Extra sources of compiled definitions, each an installed package specifier
   * (`@acme/widgets`), an `http(s)` URL, a local file/dir path to a compiled
   * manifest, or a local `.js`/`.mjs`/`.cjs` module exporting a custom
   * `DefinitionLoader` (loaded only in a trusted workspace). Resolved to a
   * {@link CompiledDefinitionSource} per entry.
   */
  definitionSources: string[]
}
