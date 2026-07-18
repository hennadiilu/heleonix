import { Errors } from "../errors/Errors"
import { HeleonixError } from "../errors/HeleonixError"
import { IDIContainer } from "./IDIContainer"
import { IDIContainerInternal } from "./IDIContainerInternal"
import { InjectableType } from "./InjectableType"

export abstract class Injectable<TAllowedInjectable extends Injectable = never> {
  private readonly diContainer: IDIContainerInternal

  public constructor(diContainer: IDIContainer) {
    if (!diContainer) {
      throw new HeleonixError(Errors.invalidInjectable, "IDIContainer")
    }

    this.diContainer = diContainer as IDIContainerInternal
  }

  public static get isSingleton(): boolean {
    return true
  }

  protected inject<TInjectable extends TAllowedInjectable>(injectable: InjectableType<TInjectable>): TInjectable {
    return this.diContainer.inject<TInjectable>(injectable.diName)
  }
}
