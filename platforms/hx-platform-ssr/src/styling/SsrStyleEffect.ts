import type { IStyleEffect, IStyleVariable, StyleHandle } from "@heleonix/hx-core"
import { cssVariableValue, styleVariableName } from "@heleonix/hx-platform-web"
import type { SsrElementState } from "./SsrElementState"
import type { SsrStyleHandle } from "./SsrStyleHandle"

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
    const property = styleVariableName(variable)
    const css = cssVariableValue(variable, value)

    if (css === undefined) {
      this.state.styles.delete(property)
    } else {
      this.state.styles.set(property, css)
    }
  }

  public removeVariable(variable: IStyleVariable): void {
    this.state.styles.delete(styleVariableName(variable))
  }

  public setClass(handle: StyleHandle): void {
    this.state.classes.add((handle as unknown as SsrStyleHandle).className)
  }

  public removeClass(handle: StyleHandle): void {
    this.state.classes.delete((handle as unknown as SsrStyleHandle).className)
  }

  public setProperty(name: string, value: string): void {
    this.state.styles.set(name, value)
  }

  public removeProperty(name: string): void {
    this.state.styles.delete(name)
  }
}
