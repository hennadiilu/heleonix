import type { Kind } from "@heleonix/hx-language"

export interface IHxEmitDefinitionSourcesOptions {
  fileName?: (kind: Kind) => string
  barrelFileName?: string | false
  jsonImportAttributes?: boolean
}
