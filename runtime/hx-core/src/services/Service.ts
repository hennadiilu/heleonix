import type { IServiceContext } from "./IServiceContext"

export abstract class Service {
  public constructor(protected readonly context: IServiceContext) {}
}
