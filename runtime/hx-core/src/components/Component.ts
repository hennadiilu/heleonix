import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"
import type { PlatformComponent } from "./PlatformComponent"
import type { DataObject } from "../common/DataObject"
import type { IComponentContext } from "./IComponentContext"

const EMPTY_COMPONENTS: readonly Component[] = Object.freeze([])

const ANONYMOUS_KEY_MARKER = "#"

function nextChildKey(usage: IComponentUsage, counters: Map<string, number>): string {
  if (usage.name !== undefined) {
    return `${usage.tag}_${usage.name}`
  }

  const index = counters.get(usage.tag) ?? 0

  counters.set(usage.tag, index + 1)

  return `${usage.tag}_${ANONYMOUS_KEY_MARKER}${index}`
}

export abstract class Component<
  TProps extends DataObject<TProps> = object,
  TEvents extends DataObject<TEvents> = object,
> {
  private _fqName = ""

  private _definition: IComponentDefinition | undefined

  private _usage: IComponentUsage | undefined

  private _parent: Component | undefined

  private _platformParent: PlatformComponent | undefined

  private _scopedParent: Component | undefined

  private _children: Component[] | undefined

  private _owner: Component | undefined

  public constructor(protected readonly context: IComponentContext) {}

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

  protected get ownHost(): PlatformComponent | undefined {
    return undefined
  }

  protected get firstHost(): PlatformComponent | undefined {
    const own = this.ownHost

    if (own) {
      return own
    }

    for (const child of this.children) {
      const host = child.firstHost

      if (host) {
        return host
      }
    }

    return undefined
  }

  public build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    this._fqName = fqName
    this._definition = definition
    this._usage = usage
    this._parent = parent
    this._scopedParent = scopedParent
    this._platformParent = platformParent

    return Promise.resolve()
  }

  public mount(anchor?: PlatformComponent): void {
    const children = this._children

    if (!children) {
      return
    }

    let next = anchor

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]

      child.mount(next)

      next = child.firstHost ?? next
    }
  }

  public async update(newDefinition: IComponentDefinition, newUsage: IComponentUsage): Promise<void> {
    this._definition = newDefinition
    this._usage = newUsage

    return Promise.resolve()
  }

  public unmount(): void {}

  public destroy(): void {
    this.destroyChildren()

    this._owner = undefined
    this._platformParent = undefined
    this._scopedParent = undefined
    this._parent = undefined
    this._usage = undefined
    this._definition = undefined
    this._fqName = ""
  }

  protected async attachChild(
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<Component> {
    const child = await this.context.components.build(usage, parent, scopedParent, platformParent)

    if (!this._children) {
      this._children = []
    }

    child._owner = this

    this._children.push(child)

    return child
  }

  protected async attachChildren(
    usages: readonly IComponentUsage[] | undefined,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    for (const usage of usages ?? []) {
      await this.attachChild(usage, parent, scopedParent, platformParent)
    }
  }

  protected async reconcileChildren(
    newUsages: readonly IComponentUsage[] | undefined,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    const oldByKey = new Map<string, Component>()
    const oldCounters = new Map<string, number>()
    const oldIndexes = new Map<Component, number>()
    const previous = this.children

    for (let i = 0; i < previous.length; i++) {
      const child = previous[i]

      oldByKey.set(nextChildKey(child.usage, oldCounters), child)
      oldIndexes.set(child, i)
    }

    const newCounters = new Map<string, number>()
    const reconciled: Component[] = []

    for (const newUsage of newUsages ?? []) {
      const key = nextChildKey(newUsage, newCounters)
      const existing = oldByKey.get(key)

      if (existing) {
        oldByKey.delete(key)

        await this.context.components.update(existing, newUsage)

        reconciled.push(existing)
      } else {
        const built = await this.context.components.build(newUsage, parent, scopedParent, platformParent)

        built._owner = this

        reconciled.push(built)
      }
    }

    this._children = reconciled.length > 0 ? reconciled : undefined

    // Before placing: a departing child's host must be out of the way, or it
    // would still be a candidate anchor for the ones that stay.
    for (const removed of oldByKey.values()) {
      this.context.components.destroy(removed)
    }

    this.placeChildren(oldIndexes)
  }

  private placeChildren(oldIndexes: ReadonlyMap<Component, number>): void {
    const children = this._children

    if (!children) {
      return
    }

    let anchor = this.anchorAfter(children.length)
    let settledOldIndex = Number.MAX_SAFE_INTEGER

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      const oldIndex = oldIndexes.get(child)

      if (oldIndex === undefined || oldIndex > settledOldIndex) {
        child.mount(anchor)
      } else {
        settledOldIndex = oldIndex
      }

      anchor = child.firstHost ?? anchor
    }
  }

  private anchorAfter(index: number): PlatformComponent | undefined {
    const children = this.children

    for (let i = index; i < children.length; i++) {
      const host = children[i].firstHost

      if (host) {
        return host
      }
    }

    if (this.ownHost) {
      return undefined
    }

    const owner = this._owner

    if (!owner) {
      return undefined
    }

    const ownIndex = owner._children?.indexOf(this) ?? -1

    return ownIndex < 0 ? undefined : owner.anchorAfter(ownIndex + 1)
  }

  private destroyChildren(): void {
    const children = this._children

    if (!children) {
      return
    }

    this._children = undefined

    for (const child of children) {
      this.context.components.destroy(child)
    }
  }
}
