import type { Action } from "./Action"

export interface IActionProvider {
  get(name: string): Action
}
