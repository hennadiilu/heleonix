import type { DiagnosticLevel } from "@heleonix/hx-plugin-core"

export interface ILanguageServerSettings {
  exclude: string[]

  diagnosticsEnabled: boolean

  /** Levels by diagnostic code, used where no `hx.config.json` sets one. */
  severity: Record<string, DiagnosticLevel>

  definitionSources: string[]

  /** Used where no `hx.config.json` sets `typescript`. */
  typescript: { projects: string[]; exclude: string[]; linkedPackages: boolean }
}
