import { joinFQPropertyName } from "@heleonix/hx-language"
import type { FQPropertyName } from "@heleonix/hx-language"
import type { Component } from "../components/Component"
import type { StateManager } from "../state/StateManager"
import type { StateChangedHandler } from "../state/StateChangedHandler"
import type { StyleEngineState } from "./StyleEngineState"

/**
 * Adapts the DI {@link StateManager} to the engine's {@link StyleEngineState}
 * seam: a component property maps to its fully-qualified state name, subscription
 * goes through the `changed` emitter, and reads through `getValue`. This is the
 * production `StyleEngineState` the DI `StyleManager` hands to a {@link StyleEngine}.
 */
export class StateManagerStyleState implements StyleEngineState<Component> {
  private readonly stateManager: StateManager

  public constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  public subscribe(component: Component, prop: string, handler: () => void): () => void {
    const name = this.fqName(component, prop)
    const wrapped: StateChangedHandler = () => handler()

    this.stateManager.changed.on(name, wrapped)

    return () => this.stateManager.changed.off(name, wrapped)
  }

  public getValue(component: Component, prop: string): unknown {
    return this.stateManager.getValue(this.fqName(component, prop))
  }

  private fqName(component: Component, prop: string): FQPropertyName {
    return joinFQPropertyName(component.fqName, prop)
  }
}
