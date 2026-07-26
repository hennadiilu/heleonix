/**
 * A component-scoped view of state handed to a qualifier's `attach`: subscribe
 * to one of the component's properties (returning an unsubscribe) and read its
 * current value. It is {@link StyleEngineState} bound to a component, so a
 * qualifier reacts to state without knowing the component type or the DI
 * `StateManager` - keeping `attach` decoupled and testable.
 */
export interface ComponentStateAccessor {
  subscribe(prop: string, handler: () => void): () => void

  getValue(prop: string): unknown
}
