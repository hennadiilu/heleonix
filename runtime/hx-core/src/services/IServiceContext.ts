import type { IServiceProvider } from "./IServiceProvider"

export interface IServiceContext {
  readonly services: IServiceProvider
}
