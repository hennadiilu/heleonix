import type { IServiceContext } from "./IServiceContext"
import type { Service } from "./Service"

export type ServiceConstructor<TService extends Service = Service> = new (context: IServiceContext) => TService
