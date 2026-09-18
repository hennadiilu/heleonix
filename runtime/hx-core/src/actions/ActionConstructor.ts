import type { Action } from "./Action"
import type { IActionContext } from "./IActionContext"

export type ActionConstructor = {
  readonly hxName: string

  new (context: IActionContext): Action
}
