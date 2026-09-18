import type { Component } from "./Component"
import type { IComponentContext } from "./IComponentContext"

export type ComponentConstructor = {
  readonly hxName: string

  new (context: IComponentContext): Component
}
