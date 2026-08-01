import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import { Injectable } from "./Injectable"
import { IDIContainer } from "./IDIContainer"
import { InjectableConstructor } from "./InjectableConstructor"
import { IDIContainerInternal } from "./IDIContainerInternal"

export class DIContainer implements IDIContainer, IDIContainerInternal {
  private readonly instances = new Map<string, Injectable>()

  private readonly injectables = new Map<string, InjectableConstructor>()

  private readonly settings = new Map<string, unknown>()

  public registerInjectables(injectables: InjectableConstructor[]): void {
    for (const injectable of injectables) {
      this.injectables.set(injectable.diName, injectable)
    }
  }

  public registerSettings<TSettings>(name: string, settings: TSettings): void {
    this.settings.set(name, settings)
  }

  public clear(): void {
    this.instances.clear()
  }

  public getSettings<TSettings>(constructorName: string): TSettings {
    return this.settings.get(constructorName) as TSettings
  }

  public inject<TInjectable extends Injectable>(constructorName: string): TInjectable {
    if (this.instances.has(constructorName)) {
      return this.instances.get(constructorName) as TInjectable
    }

    const Constructor = this.injectables.get(constructorName)

    if (!Constructor) {
      throw new HeleonixError(Errors.unknownFrameworkElement, constructorName)
    }

    const instance = new Constructor(this)

    if (Constructor.isSingleton) {
      this.instances.set(constructorName, instance)
    }

    return instance as TInjectable
  }
}
