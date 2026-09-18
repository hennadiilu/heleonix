import { Component, PlatformComponent } from "@heleonix/hx-core"
import type { SchedulerJob } from "@heleonix/hx-core"
import type { IComponentDefinition, IComponentUsage } from "@heleonix/hx-language"
import { PROPERTY_NAME_SEGMENT_SEPARATOR, getPropertySegments, joinFQPropertyName } from "@heleonix/hx-language"

type PropertyClassification = "event" | "property" | "attribute"

interface DomListenerEntry {
  count: number
  nativeHandler: (event: Event) => void
  subscribers: Set<(event: unknown) => void>
}

interface EventSubscriptionEntry {
  remove: () => void
  activeSubPaths: Set<string>
}

export class WebPlatformComponent extends PlatformComponent {
  public static readonly hxName = "WebPlatformComponent"

  private native!: HTMLElement

  private readonly pendingProperties = new Map<string, unknown>()

  private readonly classifyCache = new Map<string, PropertyClassification>()

  private readonly eventSubscriptions = new Map<string, EventSubscriptionEntry>()

  private readonly domListeners = new Map<string, DomListenerEntry>()

  public get roots(): readonly HTMLElement[] {
    return this.native ? [this.native] : []
  }

  public adoptNative(element: HTMLElement): void {
    this.native = element
  }

  public override setContent(content: string): void {
    this.scheduleWrite("textContent", content)
  }

  public override setProperty(property: string, value: unknown): void {
    this.scheduleWrite(property, value)
  }

  public override build(
    fqName: string,
    definition: IComponentDefinition,
    usage: IComponentUsage,
    parent: Component | undefined,
    scopedParent: Component | undefined,
    platformParent: PlatformComponent | undefined,
  ): Promise<void> {
    this.native = document.createElement(definition.tag)

    return super.build(fqName, definition, usage, parent, scopedParent, platformParent)
  }

  public override mount(anchor?: PlatformComponent): void {
    const host = this.platformParent

    if (!(host instanceof WebPlatformComponent)) {
      return
    }

    const anchorNative = anchor instanceof WebPlatformComponent ? anchor.native : null
    const before = anchorNative && anchorNative.parentNode === host.native ? anchorNative : null

    if (this.native.parentNode === host.native && this.native.nextSibling === before) {
      return
    }

    host.native.insertBefore(this.native, before)
  }

  public override unmount(): void {
    const host = this.platformParent

    if (!(host instanceof WebPlatformComponent)) {
      return
    }

    if (host.native.contains(this.native)) {
      host.native.removeChild(this.native)
    }
  }

  public override destroy(): void {
    super.destroy()

    for (const entry of this.eventSubscriptions.values()) {
      entry.remove()
    }

    this.eventSubscriptions.clear()

    this.classifyCache.clear()

    this.pendingProperties.clear()
  }

  public override activateBinding(sourceLocalPath: string): void {
    const kind = this.classify(sourceLocalPath)

    switch (kind) {
      case "event": {
        const sepIdx = sourceLocalPath.indexOf(PROPERTY_NAME_SEGMENT_SEPARATOR)
        const eventName = sepIdx >= 0 ? sourceLocalPath.slice(0, sepIdx) : sourceLocalPath
        const subPath = sepIdx >= 0 ? sourceLocalPath.slice(sepIdx + 1) : ""

        this.acquireEventSource(eventName, subPath)

        break
      }
      case "property": {
        // DOM → state for IDL props is explicit: bind `input.target.value` (or another event + path).
        break
      }
      default: {
        break
      }
    }
  }

  public override deactivateBinding(sourceLocalPath: string): void {
    const kind = this.classify(sourceLocalPath)

    switch (kind) {
      case "event": {
        const sepIdx = sourceLocalPath.indexOf(PROPERTY_NAME_SEGMENT_SEPARATOR)
        const eventName = sepIdx >= 0 ? sourceLocalPath.slice(0, sepIdx) : sourceLocalPath
        const subPath = sepIdx >= 0 ? sourceLocalPath.slice(sepIdx + 1) : ""

        this.releaseEventSource(eventName, subPath)

        break
      }
      case "property": {
        break
      }
      default: {
        break
      }
    }
  }

  private acquireEventSource(eventName: string, subPath: string): void {
    if (this.classify(eventName) !== "event") {
      return
    }

    let entry = this.eventSubscriptions.get(eventName)

    if (!entry) {
      const activeSubPaths = new Set<string>()

      const remove = this.addDomListener(eventName, (event) => {
        const payload = this.buildEventPayload(event, activeSubPaths)

        this.context.state.emitEvent(joinFQPropertyName(this.fqName, eventName), payload)
      })

      entry = { remove, activeSubPaths }

      this.eventSubscriptions.set(eventName, entry)
    }

    entry.activeSubPaths.add(subPath)
  }

  private releaseEventSource(eventName: string, subPath: string): void {
    const entry = this.eventSubscriptions.get(eventName)

    if (!entry) {
      return
    }

    entry.activeSubPaths.delete(subPath)

    if (entry.activeSubPaths.size === 0) {
      entry.remove()

      this.eventSubscriptions.delete(eventName)
    }
  }

  private classify(name: string): PropertyClassification {
    const cached = this.classifyCache.get(name)

    if (cached !== undefined) {
      return cached
    }

    const kind = this.classifyName(name)

    this.classifyCache.set(name, kind)

    return kind
  }

  private classifyName(name: string): PropertyClassification {
    const sepIdx = name.indexOf(PROPERTY_NAME_SEGMENT_SEPARATOR)
    const head = sepIdx >= 0 ? name.slice(0, sepIdx) : name
    const element = this.native as unknown as Record<string, unknown>

    if (`on${head}` in element) {
      return "event"
    }

    if (sepIdx < 0 && head in element) {
      return "property"
    }

    return "attribute"
  }

  private writeProperty(name: string, value: unknown): void {
    const target = this.native as unknown as Record<string, unknown>

    if (!Object.is(target[name], value)) {
      target[name] = value
    }
  }

  private writeAttribute(name: string, value: unknown): void {
    const normalized = this.normalizeAttribute(value)

    if (normalized === null || normalized === undefined || normalized === false) {
      this.native.removeAttribute(name)

      return
    }

    if (normalized === true) {
      this.native.setAttribute(name, "")

      return
    }

    this.native.setAttribute(name, normalized)
  }

  private addDomListener(eventName: string, handler: (event: unknown) => void): () => void {
    const native = this.native

    let entry = this.domListeners.get(eventName)

    if (!entry) {
      const subscribers = new Set<(event: unknown) => void>()

      const nativeHandler = (event: Event): void => {
        for (const sub of subscribers) {
          sub(event)
        }
      }

      entry = { count: 0, nativeHandler, subscribers }

      this.domListeners.set(eventName, entry)

      native.addEventListener(eventName, nativeHandler)
    }

    entry.subscribers.add(handler)
    entry.count++

    return () => {
      const e = this.domListeners.get(eventName)

      if (!e) {
        return
      }

      e.subscribers.delete(handler)
      e.count--

      if (e.count <= 0) {
        native.removeEventListener(eventName, e.nativeHandler)

        this.domListeners.delete(eventName)
      }
    }
  }

  private scheduleWrite(property: string, value: unknown): void {
    this.pendingProperties.set(property, value)

    this.context.scheduler.scheduleCommit(this.flushProperties)
  }

  private readonly flushProperties: SchedulerJob = () => {
    for (const [name, value] of this.pendingProperties) {
      const kind = this.classify(name)

      switch (kind) {
        case "property":
          this.writeProperty(name, value)
          break
        case "attribute":
          this.writeAttribute(name, value)
          break
        case "event":
          // Events are output-only; never written.
          break
      }
    }

    this.pendingProperties.clear()
  }

  private buildEventPayload(event: unknown, subPaths: Set<string>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const path of subPaths) {
      if (!path) {
        continue
      }

      const segments = getPropertySegments(path)

      let src: Record<string, unknown> | null | undefined = event as Record<string, unknown>

      let dst: Record<string, unknown> = result

      let aborted = false

      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i]

        if (src == null || typeof src !== "object") {
          aborted = true

          break
        }

        const next = src[seg]

        if (next == null || typeof next !== "object") {
          aborted = true

          break
        }

        src = next as Record<string, unknown>

        const existing = dst[seg]

        if (existing === undefined || existing === null || typeof existing !== "object") {
          dst[seg] = {}
        }

        dst = dst[seg] as Record<string, unknown>
      }

      if (!aborted && src != null && typeof src === "object") {
        const last = segments[segments.length - 1]

        dst[last] = src[last]
      }
    }

    return result
  }

  private normalizeAttribute(value: unknown): string | boolean | null | undefined {
    if (value === null || value === undefined || typeof value === "boolean" || typeof value === "string") {
      return value
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value)
  }
}
