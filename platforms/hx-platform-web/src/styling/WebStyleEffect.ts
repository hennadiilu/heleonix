import type { StyleEffect, StyleHandle } from "@heleonix/hx-core"
import { mangleVariable } from "./mangleVariable"
import { StyleWriteScheduler, synchronousScheduler } from "./StyleWriteScheduler"
import type { WebStyleHandle } from "./WebStyleHandle"

/**
 * The DOM implementation of {@link StyleEffect} for one component: every op fans
 * out to each of the component's root elements, batched through a
 * {@link StyleWriteScheduler} (a `requestAnimationFrame` flush in the browser) so
 * a styling burst touches the DOM once per frame. `setVariable`/`removeVariable`
 * take the core's neutral key and mangle it to the `--hx-` custom property the
 * composed classes reference; `setProperty`/`removeProperty` use CSSOM names
 * directly; `setClass`/`removeClass` read the class off the opaque handle.
 */
export class WebStyleEffect implements StyleEffect {
  private readonly roots: readonly HTMLElement[]

  private readonly scheduler: StyleWriteScheduler

  public constructor(roots: readonly HTMLElement[], scheduler: StyleWriteScheduler = synchronousScheduler) {
    this.roots = roots
    this.scheduler = scheduler
  }

  public setAttribute(name: string, value: string): void {
    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.setAttribute(name, value)
      }
    })
  }

  public removeAttribute(name: string): void {
    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.removeAttribute(name)
      }
    })
  }

  public setVariable(name: string, value: string): void {
    const property = mangleVariable(name)

    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.style.setProperty(property, value)
      }
    })
  }

  public removeVariable(name: string): void {
    const property = mangleVariable(name)

    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.style.removeProperty(property)
      }
    })
  }

  public setClass(handle: StyleHandle): void {
    const { className } = handle as unknown as WebStyleHandle

    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.classList.add(className)
      }
    })
  }

  public removeClass(handle: StyleHandle): void {
    const { className } = handle as unknown as WebStyleHandle

    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.classList.remove(className)
      }
    })
  }

  public setProperty(name: string, value: string): void {
    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.style.setProperty(name, value)
      }
    })
  }

  public removeProperty(name: string): void {
    this.scheduler.write(() => {
      for (const root of this.roots) {
        root.style.removeProperty(name)
      }
    })
  }
}
