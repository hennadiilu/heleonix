import { DiagnosticSeverity } from "vscode-languageserver"
import type { IComponentInfo, IRegistryInfo, IThemeTokenLocation } from "@heleonix/hx-analyzer"
import type { IQualifierDefinition } from "@heleonix/hx-language"
import { DefinitionIndex } from "../index/DefinitionIndex"

/** Per-request inputs handed to a language service. */
export interface ILanguageContext {
  index: DefinitionIndex

  /** Severity for unresolved dictionary/config references; `undefined` disables the check. */
  unknownReferenceSeverity: DiagnosticSeverity | undefined

  /** Severity for dictionary/config entry keys referenced nowhere; `undefined` disables the check. */
  unusedEntrySeverity: DiagnosticSeverity | undefined

  /** Converters known to the TypeScript-backed analyzer (name, params, docs, location). */
  converters: readonly IRegistryInfo[]

  /** Actions known to the TypeScript-backed analyzer (name, params, docs, location). */
  actions: readonly IRegistryInfo[]

  /** Components known to the analyzer (workspace + native), with members, docs and openness. */
  components: readonly IComponentInfo[]

  /** The merged theme token space (`{$...}`-addressable dot-path -> value) from workspace `*.hxt` + meta. */
  themeTokens: ReadonlyMap<string, string>

  /** Style qualifiers known to the analyzer (discovered classes + meta), with args and ref kinds. */
  qualifiers: readonly IQualifierDefinition[]

  /** Control names per component (workspace + meta), for `@hx-style(for: ...)` scope completion. */
  controlNames: ReadonlyMap<string, readonly string[]>

  /** Where each workspace theme token is defined, for `{$...}` go-to-definition. */
  themeTokenLocations: ReadonlyMap<string, IThemeTokenLocation>
}
