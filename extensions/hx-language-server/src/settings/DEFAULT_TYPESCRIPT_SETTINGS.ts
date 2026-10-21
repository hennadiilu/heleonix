import type { ILanguageServerSettings } from "./ILanguageServerSettings"

// Mirrors the `heleonix.hx.typescript.*` defaults contributed by the extension's package.json.
export const DEFAULT_TYPESCRIPT_SETTINGS: ILanguageServerSettings["typescript"] = {
  projects: ["**/tsconfig.json"],
  exclude: ["**/*.{spec,test}.{ts,tsx,mts,cts}", "**/{spec,specs,test,tests,__tests__}/**"],
  linkedPackages: false,
}
