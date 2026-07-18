import { Injectable } from "./Injectable"
import { IDIContainer } from "./IDIContainer"

export type InjectableType<TInjectable extends Injectable = Injectable> = (abstract new (
  diContainer: IDIContainer,
) => TInjectable) & {
  readonly isSingleton: boolean
  readonly diName: string
}
