import type { IDimensionDefinition } from "@heleonix/hx-language"
import type { DiagnosticLevel } from "./DiagnosticLevel"
import type { IHxConfigPatterns } from "./IHxConfigPatterns"

/**
 * An `hx.config.json` with the configurations it extends merged in and its paths resolved against the files
 * declaring them - one view shared by builds, editors and tooling.
 */
export interface IHxConfig {
  /** The configuration file governing the directory (the configurations it extends are merged in). */
  file: string

  /** The directories holding the sources to compile. */
  include?: string[]

  /** Folder names skipped anywhere, or absolute paths skipped below `include`. */
  exclude?: string[]

  dimensions?: IDimensionDefinition[]

  typescript?: {
    /** The `tsconfig` projects whose classes editors discover. */
    projects?: IHxConfigPatterns

    /** TypeScript sources left out of discovery. */
    exclude?: IHxConfigPatterns

    /** Whether editors also read dependencies linked in from outside the workspace. */
    linkedPackages?: boolean
  }

  diagnostics?: {
    /** Levels by diagnostic code, overriding each diagnostic's own. */
    severity?: Record<string, DiagnosticLevel>

    /** Whether a build fails on warnings too. */
    failOnWarnings?: boolean
  }
}
