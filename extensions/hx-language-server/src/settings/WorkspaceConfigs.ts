import path from "node:path"
import { isIncludedSource, isSkipped, loadHxConfig, parseAssetFileName } from "@heleonix/hx-plugin-core"
import type {
  DiagnosticLevel,
  IHxConfig,
  IHxConfigError,
  IHxConfigHost,
  IHxConfigPatterns,
  IHxConfigResult,
} from "@heleonix/hx-plugin-core"
import type { IDimension } from "@heleonix/hx-language"
import { DEFAULT_TYPESCRIPT_SETTINGS } from "./DEFAULT_TYPESCRIPT_SETTINGS"
import type { ILanguageServerSettings } from "./ILanguageServerSettings"

const DEFAULT_EXCLUDE = ["node_modules"]

/**
 * The `hx.config.json` governing each workspace file - the same configuration its build reads: which sources it
 * compiles, under which dimensions, at which diagnostic levels. Editor settings fill in what no configuration sets.
 */
export class WorkspaceConfigs {
  private readonly lookups = new Map<string, IHxConfigResult>()

  /**
   * @param host How configuration files are read - an editor's reads its unsaved documents first.
   */
  public constructor(
    private readonly fallback: Pick<ILanguageServerSettings, "severity" | "typescript"> = {
      severity: {},
      typescript: DEFAULT_TYPESCRIPT_SETTINGS,
    },
    private readonly host?: IHxConfigHost,
  ) {}

  /** The configuration governing a directory, read once; a broken one counts as none and is reported. */
  public configOf(dir: string): IHxConfig | undefined {
    const key = path.resolve(dir)
    let lookup = this.lookups.get(key)

    if (!lookup) {
      lookup = loadHxConfig(key, this.host)
      this.lookups.set(key, lookup)
    }

    return lookup.config
  }

  /** Whether the build governing a file compiles it: one of its sources, within its dimensions. */
  public compiles(filePath: string): boolean {
    const config = this.configOf(path.dirname(filePath))

    if (!config) {
      return true
    }

    const include = config.include ?? [path.dirname(config.file)]

    if (!isIncludedSource(filePath, include, config.exclude ?? DEFAULT_EXCLUDE)) {
      return false
    }

    try {
      return !config.dimensions || !isSkipped(parseAssetFileName(filePath, config.dimensions))
    } catch {
      // An ambiguous file name fails the build itself; the editor still reads it.
      return true
    }
  }

  /** A file's definition name and dimension, read the way its build reads them. */
  public assetOf(filePath: string): { name: string; dimension: IDimension } {
    const dimensions = this.configOf(path.dirname(filePath))?.dimensions

    if (dimensions) {
      try {
        const asset = parseAssetFileName(filePath, dimensions)

        if (!isSkipped(asset)) {
          return { name: asset.name, dimension: asset.dimension }
        }
      } catch {
        // Falls back to the plain name below.
      }
    }

    return { name: path.basename(filePath).split(".")[0], dimension: {} }
  }

  /** The level of a diagnostic in a file: its configuration's, else the editor setting's, else its own. */
  public levelOf(code: string, own: DiagnosticLevel, filePath?: string): DiagnosticLevel {
    const configured =
      filePath === undefined ? undefined : this.configOf(path.dirname(filePath))?.diagnostics?.severity?.[code]

    return configured ?? this.fallback.severity[code] ?? own
  }

  /** The TypeScript settings of a workspace folder: its configuration's, else the editor settings. */
  public typescriptOf(root: string): {
    projects: IHxConfigPatterns
    exclude: IHxConfigPatterns
    linkedPackages: boolean
  } {
    const typescript = this.configOf(root)?.typescript

    return {
      projects: typescript?.projects ?? { base: root, patterns: [...this.fallback.typescript.projects] },
      exclude: typescript?.exclude ?? { base: root, patterns: [...this.fallback.typescript.exclude] },
      linkedPackages: typescript?.linkedPackages ?? this.fallback.typescript.linkedPackages,
    }
  }

  /** Why configurations failed to load - one error per file at fault. */
  public errors(): IHxConfigError[] {
    const byFile = new Map<string, IHxConfigError>()

    for (const lookup of this.lookups.values()) {
      if (lookup.error) {
        byFile.set(lookup.error.file, lookup.error)
      }
    }

    return [...byFile.values()]
  }

  /**
   * Every file the configurations read, and every place one was looked for in vain - a change at any of them may
   * change what the workspace compiles.
   */
  public inputs(): { files: string[]; missing: string[] } {
    const files = new Set<string>()
    const missing = new Set<string>()

    for (const lookup of this.lookups.values()) {
      lookup.files.forEach((file) => files.add(file))
      lookup.missing.forEach((file) => missing.add(file))
    }

    return { files: [...files], missing: [...missing] }
  }

  /** Whether a file is one a configuration read, or was looked for at. */
  public isInput(filePath: string): boolean {
    const resolved = path.resolve(filePath)
    const same = (file: string): boolean =>
      process.platform === "win32" ? file.toLowerCase() === resolved.toLowerCase() : file === resolved

    for (const lookup of this.lookups.values()) {
      if (lookup.files.some(same) || lookup.missing.some(same)) {
        return true
      }
    }

    return false
  }

  /** Forgets every configuration read - one changed. */
  public clear(): void {
    this.lookups.clear()
  }
}
