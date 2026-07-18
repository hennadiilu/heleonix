import { Injectable } from "./Injectable"

export interface IDIContainerInternal {
  inject<TInjectable extends Injectable>(constructorName: string): TInjectable

  getSettings<TSettings>(constructorName: string): TSettings
}
