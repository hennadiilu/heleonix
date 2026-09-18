import type { IScheduler, IStyleEffect, StyleHandle } from "@heleonix/hx-core"
import { mangleVariable } from "./mangleVariable"
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

  public setVariable(name: string, value: string): void {
    const property = mangleVariable(name)

    this.scheduler.scheduleCommit(() => {
      for (const root of this.roots) {
        root.style.setProperty(property, value)
      }
    })
  }

  public removeVariable(name: string): void {
    const property = mangleVariable(name)

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
