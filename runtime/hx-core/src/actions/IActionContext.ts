import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDictionaryProvider } from "../dictionaries/IDictionaryProvider"
import type { IDimensionController } from "../dimensions/IDimensionController"
import type { IServiceProvider } from "../services/IServiceProvider"

export interface IActionContext {
  readonly configs: IConfigProvider

  readonly dictionaries: IDictionaryProvider

  readonly services: IServiceProvider

  readonly dimensions: IDimensionController
}
