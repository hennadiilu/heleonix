import type { IThemeDefinition } from "@heleonix/hx-language"

export interface IThemeManager {
  getTheme(): Promise<IThemeDefinition | undefined>

  apply(): Promise<void>
}
