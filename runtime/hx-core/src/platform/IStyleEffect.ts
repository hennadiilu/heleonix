import type { IStyleVariable } from "./IStyleVariable"
import type { StyleHandle } from "./StyleHandle"

export interface IStyleEffect {
  setAttribute(name: string, value: string): void

  removeAttribute(name: string): void

  setVariable(variable: IStyleVariable, value: string): void

  removeVariable(variable: IStyleVariable): void

  setClass(handle: StyleHandle): void

  removeClass(handle: StyleHandle): void

  setProperty(name: string, value: string): void

  removeProperty(name: string): void
}
