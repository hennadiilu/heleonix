import { DEFAULT_TYPESCRIPT_SETTINGS } from "./DEFAULT_TYPESCRIPT_SETTINGS"
import type { ILanguageServerOptions } from "./ILanguageServerOptions"
import type { ILanguageServerSettings } from "./ILanguageServerSettings"

/** A host's options with the defaults filled in. */
export function settingsOf(options: ILanguageServerOptions): ILanguageServerSettings {
  return {
    exclude: options.exclude ?? [],
    diagnosticsEnabled: options.diagnostics?.enable !== false,
    severity: options.diagnostics?.severity ?? {},
    definitionSources: options.definitionSources ?? [],
    typescript: {
      projects: options.typescript?.projects ?? DEFAULT_TYPESCRIPT_SETTINGS.projects,
      exclude: options.typescript?.exclude ?? DEFAULT_TYPESCRIPT_SETTINGS.exclude,
      linkedPackages: options.typescript?.linkedPackages ?? DEFAULT_TYPESCRIPT_SETTINGS.linkedPackages,
    },
  }
}
