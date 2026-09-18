import type { IAssetFile } from "./IAssetFile"

export interface IGenerateDefinitionSourceOptions {
  loading?: "eager" | "lazy"
  request?: (file: IAssetFile) => string
  chunkName?: (file: IAssetFile) => string | undefined
  importAttributes?: boolean
}
