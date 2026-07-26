/**
 * The state seam the style engine uses to make `{prop}` declarations reactive:
 * subscribe to a component property (returning an unsubscribe), and read its
 * current value. Kept abstract so the engine stays testable without the DI
 * `StateManager`; the DI `StyleManager` supplies a `StateManager`-backed impl.
 */
export interface StyleEngineState<TComponent> {
  subscribe(component: TComponent, prop: string, handler: () => void): () => void

  getValue(component: TComponent, prop: string): unknown
}
