import type { IScheduler, IStyleEffect, IStyleVariable } from "@heleonix/hx-core"
import { cssVariableValue } from "./cssVariableValue"

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
    const property = `--${variable.name}`
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
    const property = `--${variable.name}`

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.style.removeProperty(property)
      }
    })
  }

  public addClass(id: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.classList.add(id)
      }
    })
  }

  public removeClass(id: string): void {
    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.classList.remove(id)
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
