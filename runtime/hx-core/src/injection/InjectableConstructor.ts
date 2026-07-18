import { Injectable } from "./Injectable"
import { IDIContainer } from "./IDIContainer"

export type InjectableConstructor<TInjectable extends Injectable = Injectable> = (new (
  diContainer: IDIContainer,
) => TInjectable) & {
  readonly isSingleton: boolean
  readonly diName: string
}
