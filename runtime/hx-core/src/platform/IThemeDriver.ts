import type { IThemeDefinition } from "@heleonix/hx-language"

export interface IThemeDriver {
  applyTokens(tokens: ReadonlyMap<string, string>): void

  applyArtifacts(theme: IThemeDefinition): void
}
