import type { Component } from "../components/Component"

export interface IStyleManager {
  apply(component: Component): Promise<void>

  remove(component: Component): void

  reapply(): Promise<void>
}
