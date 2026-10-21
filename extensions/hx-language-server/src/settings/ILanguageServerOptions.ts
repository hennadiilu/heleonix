import type { DiagnosticLevel } from "@heleonix/hx-plugin-core"

/**
 * What a host passes the server - as `initializationOptions`, and again under `settings.heleonix.hx` of a
 * `workspace/didChangeConfiguration` - mirroring the `heleonix.hx.*` settings of the VS Code extension. All
 * optional. A workspace's `hx.config.json` wins over the project-level ones (diagnostic levels, TypeScript).
 */
export interface ILanguageServerOptions {
  /** Folder names never indexed, besides `node_modules`, `dist`, `temp` and `out`. */
  exclude?: string[]

  diagnostics?: {
    /** Whether diagnostics are published at all (default `true`). */
    enable?: boolean

    /** Levels by diagnostic code, where no `hx.config.json` sets one. */
    severity?: Record<string, DiagnosticLevel>
  }

  /** Compiled definitions beyond the workspace: package specifiers, `http(s)` URLs, local paths or modules. */
  definitionSources?: string[]

  /** Where no `hx.config.json` sets `typescript`. */
  typescript?: {
    projects?: string[]

    exclude?: string[]

    linkedPackages?: boolean
  }

  /** Whether the workspace is trusted: custom definition-source modules run workspace code, so only then. */
  workspaceTrusted?: boolean
}
