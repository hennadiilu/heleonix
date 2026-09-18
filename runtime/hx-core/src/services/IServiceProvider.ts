import type { Service } from "./Service"
import type { ServiceConstructor } from "./ServiceConstructor"

export interface IServiceProvider {
  get<TService extends Service>(ctor: ServiceConstructor<TService>): TService
}
