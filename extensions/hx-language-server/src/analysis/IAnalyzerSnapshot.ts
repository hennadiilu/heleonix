import type { IComponentInfo, IConverterActionInfo, IThemeTokenLocation } from "@heleonix/hx-analyzer"
import type { IQualifierDefinition } from "@heleonix/hx-language"

export interface IAnalyzerSnapshot {
  converters: readonly IConverterActionInfo[]

  actions: readonly IConverterActionInfo[]

  components: readonly IComponentInfo[]

  themeTokens: ReadonlyMap<string, string>

  qualifiers: readonly IQualifierDefinition[]

  controlNames: ReadonlyMap<string, readonly string[]>

  themeTokenLocations: ReadonlyMap<string, IThemeTokenLocation>
}
