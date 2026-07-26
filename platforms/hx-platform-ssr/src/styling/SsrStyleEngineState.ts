import type { StyleEngineState } from "@heleonix/hx-core"

/**
 * The SSR {@link StyleEngineState}: reads a component's current property values
 * for `{prop}` declarations but never subscribes - a server render is a single
 * pass with no reactivity, so `subscribe` is a no-op returning a no-op disposer.
 * The engine still pushes each `{prop}`'s initial value through the effect once,
 * so it lands in the element's inline style; the client re-subscribes on hydrate.
 */
export class SsrStyleEngineState<TComponent> implements StyleEngineState<TComponent> {
  private readonly read: (component: TComponent, prop: string) => unknown

  public constructor(read: (component: TComponent, prop: string) => unknown) {
    this.read = read
  }

  public subscribe(): () => void {
    return () => {}
  }

  public getValue(component: TComponent, prop: string): unknown {
    return this.read(component, prop)
  }
}
