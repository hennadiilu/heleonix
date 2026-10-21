import path from "node:path"
import type { IHxBuildOptions } from "./IHxBuildOptions"
import type { IHxBuildSettings } from "./IHxBuildSettings"
import type { IHxConfigHost } from "./IHxConfigHost"
import { loadHxConfig } from "./loadHxConfig"

/**
 * The settings of a build whose context (the package being built) is `context`: the bundler plugin's options over
 * the `hx.config.json` governing it, over the defaults - every source under `context`, outside `node_modules`.
 */
export function resolveBuildSettings(
  context: string,
  options: IHxBuildOptions = {},
  host?: IHxConfigHost,
): IHxBuildSettings {
  const lookup = loadHxConfig(context, host)
  const config = lookup.config
  const settings: IHxBuildSettings = {
    lookup,
    include:
      options.include === undefined
        ? (config?.include ?? [path.resolve(context)])
        : toArray(options.include).map((dir) => path.resolve(context, dir)),
    exclude:
      options.exclude === undefined
        ? (config?.exclude ?? ["node_modules"])
        : toArray(options.exclude).map((entry) =>
            path.isAbsolute(entry) || /[\\/]/.test(entry) ? path.resolve(context, entry) : entry,
          ),
    dimensions: [...(options.dimensions ?? config?.dimensions ?? [])],
    severity: config?.diagnostics?.severity ?? {},
    failOnWarnings: options.failOnWarnings ?? config?.diagnostics?.failOnWarnings ?? false,
  }

  if (config?.typescript?.exclude) {
    settings.typescriptExclude = config.typescript.exclude
  }

  return settings
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}
