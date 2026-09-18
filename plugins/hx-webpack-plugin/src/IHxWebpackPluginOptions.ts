import type { IDimensionDefinition } from "@heleonix/hx-language"
import type { Kind } from "@heleonix/hx-language"
import type { IAssetFile } from "@heleonix/hx-plugin-core"
import { IHxDefinitionSourceOptions } from "./IHxDefinitionSourceOptions"
import { IHxEmitDefinitionSourcesOptions } from "./IHxEmitDefinitionSourcesOptions"

export interface IHxWebpackPluginOptions {
  dimensions?: readonly IDimensionDefinition[]
  include?: string | string[]
  exclude?: string | string[]
  kinds?: readonly Kind[]
  sources?: Partial<Record<Kind, IHxDefinitionSourceOptions>>
  declarationFile?: string
  loading?: "eager" | "lazy"
  chunkName?: (file: IAssetFile) => string | undefined
  emitJson?: boolean | ((file: IAssetFile) => string)
  emitMeta?: boolean | string
  validate?: boolean | { failOnWarnings?: boolean }
  emitDefinitionSources?: boolean | IHxEmitDefinitionSourcesOptions
}
