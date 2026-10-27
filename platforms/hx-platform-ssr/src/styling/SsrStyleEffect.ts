import type { IStyleEffect, IStyleVariable } from "@heleonix/hx-core"
import { cssVariableValue } from "@heleonix/hx-platform-web"
import type { SsrElementState } from "./SsrElementState"

export class SsrStyleEffect implements IStyleEffect {
  private readonly state: SsrElementState

  public constructor(state: SsrElementState) {
    this.state = state
  }

  public setAttribute(name: string, value: string): void {
    this.state.attributes.set(name, value)
  }

  public removeAttribute(name: string): void {
    this.state.attributes.delete(name)
  }

  public setVariable(variable: IStyleVariable, value: string): void {
    const property = `--${variable.name}`
    const css = cssVariableValue(variable, value)

    if (css === undefined) {
      this.state.styles.delete(property)
    } else {
      this.state.styles.set(property, css)
    }
  }

  public removeVariable(variable: IStyleVariable): void {
    this.state.styles.delete(`--${variable.name}`)
  }

  public addClass(id: string): void {
    this.state.classes.add(id)
  }

  public removeClass(id: string): void {
    this.state.classes.delete(id)
  }

  public setProperty(name: string, value: string): void {
    this.state.styles.set(name, value)
  }

  public removeProperty(name: string): void {
    this.state.styles.delete(name)
  }
}
