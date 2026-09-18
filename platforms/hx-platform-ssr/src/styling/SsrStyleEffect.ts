import type { IStyleEffect, StyleHandle } from "@heleonix/hx-core"
import { mangleVariable } from "@heleonix/hx-platform-web"
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

  public setVariable(name: string, value: string): void {
    this.state.styles.set(mangleVariable(name), value)
  }

  public removeVariable(name: string): void {
    this.state.styles.delete(mangleVariable(name))
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
