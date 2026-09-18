import type { Service } from "./Service"
import type { IServiceContext } from "./IServiceContext"
import type { IServiceProvider } from "./IServiceProvider"
import type { ServiceConstructor } from "./ServiceConstructor"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import type { IClearable } from "../common/IClearable"

export class ServiceProvider implements IServiceProvider, IClearable {
  private readonly instances = new Map<ServiceConstructor, Service>()

  private readonly resolving = new Set<ServiceConstructor>()

  private readonly context: IServiceContext = { services: this }

  public constructor(private readonly serviceCtors: ReadonlySet<ServiceConstructor>) {}

  public clear(): void {
    this.instances.clear()
    this.resolving.clear()
  }

  public get<TService extends Service>(ctor: ServiceConstructor<TService>): TService {
    const key = ctor as ServiceConstructor

    let instance = this.instances.get(key)

    if (!instance) {
      if (!this.serviceCtors.has(key)) {
        throw new HeleonixError(Errors.unknownService, ctor.name)
      }

      if (this.resolving.has(key)) {
        throw new HeleonixError(Errors.circularServiceDependency, ctor.name)
      }

      this.resolving.add(key)

      try {
        instance = new ctor(this.context)
      } finally {
        this.resolving.delete(key)
      }

      this.instances.set(key, instance)
    }

    return instance as TService
  }
}
