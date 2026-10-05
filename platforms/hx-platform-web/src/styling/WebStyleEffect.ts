import type { IScheduler, IStyleEffect, IStyleVariable, StyleHandle } from "@heleonix/hx-core"
import { cssVariableValue } from "./cssVariableValue"
import { styleVariableName } from "./styleVariableName"
import type { WebStyleHandle } from "./WebStyleHandle"

export class WebStyleEffect implements IStyleEffect {
  private readonly roots: readonly HTMLElement[]

  private readonly scheduler: IScheduler

  public constructor(roots: readonly HTMLElement[], scheduler: IScheduler) {
    this.roots = roots
    this.scheduler = scheduler
  }

  public setAttribute(name: string, value: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.setAttribute(name, value)
      }
    })
  }

  public removeAttribute(name: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.removeAttribute(name)
      }
    })
  }

  public setVariable(variable: IStyleVariable, value: string): void {
    const property = styleVariableName(variable)
    const css = cssVariableValue(variable, value)

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        if (css === undefined) {
          root.style.removeProperty(property)
        } else {
          root.style.setProperty(property, css)
        }
      }
    })
  }

  public removeVariable(variable: IStyleVariable): void {
    const property = styleVariableName(variable)

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.style.removeProperty(property)
      }
    })
  }

  public setClass(handle: StyleHandle): void {
    const { className } = handle as unknown as WebStyleHandle

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.classList.add(className)
      }
    })
  }

  public removeClass(handle: StyleHandle): void {
    const { className } = handle as unknown as WebStyleHandle

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.classList.remove(className)
      }
    })
  }

  public setProperty(name: string, value: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.style.setProperty(name, value)
      }
    })
  }

  public removeProperty(name: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.style.removeProperty(name)
      }
    })
  }
}
