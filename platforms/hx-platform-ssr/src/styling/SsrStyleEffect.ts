import type { StyleEffect, StyleHandle } from "@heleonix/hx-core"
import { mangleVariable } from "@heleonix/hx-platform-web"
import type { SsrElementState } from "./SsrElementState"
import type { SsrStyleHandle } from "./SsrStyleHandle"

/**
 * The SSR implementation of {@link StyleEffect} for one component: every op
 * mutates its {@link SsrElementState} instead of a DOM node, so the exact same
 * `attach()` calls the client runs at hydration are serialized into markup on
 * the server. `setVariable`/`removeVariable` mangle the core's neutral key to the
 * same `--hx-` custom property the composed classes reference (via the web's
 * {@link mangleVariable}), so server and client agree byte-for-byte.
 */
export class SsrStyleEffect implements StyleEffect {
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
