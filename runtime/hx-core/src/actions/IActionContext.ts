import type { IConfigProvider } from "../configs/IConfigProvider"
import type { IDimensionController } from "../dimension/IDimensionController"
import type { IServiceProvider } from "../services/IServiceProvider"

export interface IActionContext {
  readonly configs: IConfigProvider

  readonly services: IServiceProvider

  readonly dimensions: IDimensionController
}
