import type { IStyleVariable } from "./IStyleVariable"

export interface IStyleEffect {
  setAttribute(name: string, value: string): void

  removeAttribute(name: string): void

  setVariable(variable: IStyleVariable, value: string): void

  removeVariable(variable: IStyleVariable): void

  addClass(id: string): void

  removeClass(id: string): void

  setProperty(name: string, value: string): void

  removeProperty(name: string): void
}
