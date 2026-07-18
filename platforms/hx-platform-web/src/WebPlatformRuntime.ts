import { Component, ComponentManager, PlatformRuntime, StateManager } from "@heleonix/hx-core"
import {
  FQComponentName,
  FQPropertyName,
  getComponentName,
  getPropertyName,
} from "@heleonix/hx-language"
import { WebPlatformComponent } from "./WebPlatformComponent"

export class WebPlatformRuntime extends PlatformRuntime {
  private readonly stateManager = this.inject(StateManager)

  private readonly componentManager = this.inject(ComponentManager)

  private readonly componentsByFq = new Map<FQComponentName, Component>()

  public start(): void {
    this.stateManager.bound.on(this.onBindingBound)
    this.stateManager.unbound.on(this.onBindingUnbound)
    this.componentManager.componentBuilt.on(this.onComponentCreated)
    this.componentManager.componentDestroyed.on(this.onComponentDestroyed)
  }

  public stop(): void {
    this.stateManager.bound.off(this.onBindingBound)
    this.stateManager.unbound.off(this.onBindingUnbound)
    this.componentManager.componentBuilt.off(this.onComponentCreated)
    this.componentManager.componentDestroyed.off(this.onComponentDestroyed)

    this.componentsByFq.clear()
  }

  private readonly onBindingBound = (left: FQPropertyName, right: FQPropertyName): void => {
    this.activateBindingEndpoint(left)
    this.activateBindingEndpoint(right)
  }

  private readonly onBindingUnbound = (left: FQPropertyName, right: FQPropertyName): void => {
    this.deactivateBindingEndpoint(left)
    this.deactivateBindingEndpoint(right)
  }

  private readonly onComponentCreated = (fq: FQComponentName, instance: Component): void => {
    this.componentsByFq.set(fq, instance)

    if (instance instanceof WebPlatformComponent) {
      this.replayOutgoingBindings(instance)
    }
  }

  private readonly onComponentDestroyed = (fq: FQComponentName): void => {
    this.componentsByFq.delete(fq)
  }

  private activateBindingEndpoint(fqProperty: FQPropertyName): void {
    const fq = getComponentName(fqProperty)
    const path = getPropertyName(fqProperty)

    if (!path) {
      return
    }

    const inst = this.getBuiltInstance(fq)

    if (inst instanceof WebPlatformComponent) {
      inst.activateBinding(path)
    }
  }

  private deactivateBindingEndpoint(fqProperty: FQPropertyName): void {
    const fq = getComponentName(fqProperty)
    const path = getPropertyName(fqProperty)

    if (!path) {
      return
    }

    const inst = this.getBuiltInstance(fq)

    if (inst instanceof WebPlatformComponent) {
      inst.deactivateBinding(path)
    }
  }

  private getBuiltInstance(fq: FQComponentName): Component | undefined {
    return this.componentsByFq.get(fq)
  }

  private replayOutgoingBindings(platform: WebPlatformComponent): void {
    const bindings = this.stateManager.getBindings(platform.fqName)

    for (const path of bindings.keys()) {
      platform.activateBinding(path)
    }
  }
}
