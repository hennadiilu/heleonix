import { FrameworkElement } from "../FrameworkElement"
import { StateManager } from "../state/StateManager"
import { DictionaryManager } from "../dictionaries/DictionaryManager"
import { ConfigManager } from "../configs/ConfigManager"
import { PlatformAdapter } from "../platform/PlatformAdapter"
import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"
import { Scheduler } from "./Scheduler"
import { ComponentManager } from "./ComponentManager"
import { DimensionManager } from "../dimension/DimensionManager"
import type { PlatformComponent } from "./PlatformComponent"

const EMPTY_COMPONENTS: readonly Component[] = Object.freeze([])

export abstract class Component extends FrameworkElement<
  ComponentManager | StateManager | DictionaryManager | ConfigManager | Scheduler | PlatformAdapter | DimensionManager
> {
  private _fqName = ""

  private _definition: IComponentDefinition | undefined

  private _usage: IComponentUsage | undefined

  private _parent: Component | undefined

  private _platformParent: PlatformComponent | undefined

  private _scopedParent: Component | undefined

  private _children: Component[] | undefined

  public static override get isSingleton(): boolean {
    return false
  }

  public get fqName(): string {
    return this._fqName
  }

  public get definition(): IComponentDefinition {
    return this._definition!
  }

  public get usage(): IComponentUsage {
    return this._usage!
  }

  public get parent(): Component | undefined {
    return this._parent
  }

  public get platformParent(): PlatformComponent | undefined {
    return this._platformParent
  }

  public get scopedParent(): Component | undefined {
    return this._scopedParent
  }

  public get children(): readonly Component[] {
    return this._children ?? EMPTY_COMPONENTS
  }

  protected set fqName(value: string) {
    this._fqName = value
  }

  protected set definition(value: IComponentDefinition) {
    this._definition = value
  }

  protected set usage(value: IComponentUsage) {
    this._usage = value
  }

  protected set parent(value: Component | undefined) {
    this._parent = value
  }

  protected set platformParent(value: PlatformComponent | undefined) {
    this._platformParent = value
  }

  protected set scopedParent(value: Component | undefined) {
    this._scopedParent = value
  }

  public appendChild(component: Component): void {
    if (!this._children) {
      this._children = []
    }

    this._children.push(component)
  }

  public removeChild(component: Component): void {
    if (!this._children) {
      return
    }

    const index = this._children.indexOf(component)

    if (index >= 0) {
      this._children.splice(index, 1)
    }

    if (this._children.length === 0) {
      this._children = undefined
    }
  }

  public build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    this.fqName = fqName
    this.definition = definition
    this.usage = usage
    this.parent = parent
    this.scopedParent = scopedParent
    this.platformParent = platformParent

    return Promise.resolve()
  }

  public mount(): void {}

  public async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    this.definition = newDefinition
    this.usage = newUsage

    return Promise.resolve()
  }

  public unmount(): void {}

  public destroy(): void {
    this._children = undefined
    this._platformParent = undefined
    this._scopedParent = undefined
    this._parent = undefined
    this._usage = undefined
    this._definition = undefined
    this._fqName = ""
  }
}
