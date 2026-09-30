import {
  FQPropertyName,
  PROPERTY_NAME_SEGMENT_SEPARATOR,
  getComponentName,
  getPropertyName,
  getPropertySegments,
  joinFQPropertyName,
} from "@heleonix/hx-language"
import type { IState } from "./IState"
import { IKeyedEventEmitter } from "../common/IKeyedEventEmitter"
import { KeyedEventEmitter } from "../common/KeyedEventEmitter"
import type { IClearable } from "../common/IClearable"
import { StateChangedHandler } from "./StateChangedHandler"

interface InterestNode {
  parent: InterestNode | null
  segment: string
  segments: readonly string[]
  fq: FQPropertyName
  children: Map<string, InterestNode>
  bindings: Set<FQPropertyName>
  subscribers: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function hasInterest(node: InterestNode): boolean {
  return node.subscribers > 0 || node.bindings.size > 0 || node.children.size > 0
}

function readAtPath(root: Record<string, unknown> | undefined, segments: readonly string[]): unknown {
  if (root === undefined || segments.length === 0) {
    return root
  }

  let current: unknown = root

  for (const segment of segments) {
    if (!isObject(current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function writeAtPath(root: Record<string, unknown>, segments: readonly string[], value: unknown): void {
  if (segments.length === 0) {
    if (!isObject(value)) {
      return
    }

    for (const key of Object.keys(root)) {
      delete root[key]
    }

    for (const key of Object.keys(value)) {
      root[key] = value[key]
    }

    return
  }

  let current = root

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]

    if (!isObject(current[segment])) {
      current[segment] = {}
    }

    current = current[segment] as Record<string, unknown>
  }

  current[segments[segments.length - 1]] = value
}

function deleteAtPath(root: Record<string, unknown>, segments: readonly string[]): void {
  if (segments.length === 0) {
    for (const key of Object.keys(root)) {
      delete root[key]
    }

    return
  }

  let current: Record<string, unknown> = root

  for (let i = 0; i < segments.length - 1; i++) {
    const next = current[segments[i]]

    if (!isObject(next)) {
      return
    }

    current = next
  }

  delete current[segments[segments.length - 1]]
}

export class StateManager implements IState, IClearable {
  private readonly data = new Map<string, Record<string, unknown>>()

  private readonly interestRoots = new Map<string, InterestNode>()

  private readonly changedEmitter: KeyedEventEmitter<FQPropertyName, StateChangedHandler>

  private propagating: Set<FQPropertyName> | null = null

  private pendingReleases: Set<FQPropertyName> | null = null

  private pendingTransients: Set<FQPropertyName> | null = null

  public constructor() {
    this.changedEmitter = new KeyedEventEmitter(this.changedOnInterceptor, this.changedOffInterceptor)
  }

  public get changed(): IKeyedEventEmitter<FQPropertyName, StateChangedHandler> {
    return this.changedEmitter
  }

  public clear(): void {
    this.data.clear()
    this.interestRoots.clear()
    this.changedEmitter.clear()

    this.propagating = null
    this.pendingReleases = null
    this.pendingTransients = null
  }

  public bind(target: FQPropertyName, source: FQPropertyName): void {
    if (target === source) {
      return
    }

    this.ensureInterestNode(target).bindings.add(source)
    this.ensureInterestNode(source).bindings.add(target)

    const seed = this.getValue(source)

    if (seed !== undefined) {
      this.applyEntry(target, seed)
    }
  }

  public unbind(target: FQPropertyName, source: FQPropertyName): void {
    this.findInterestNode(target)?.bindings.delete(source)
    this.findInterestNode(source)?.bindings.delete(target)

    this.scheduleRelease(target)
    this.scheduleRelease(source)
  }

  public getValue(fqPropertyName: FQPropertyName): unknown {
    return readAtPath(
      this.data.get(getComponentName(fqPropertyName)),
      getPropertySegments(getPropertyName(fqPropertyName)),
    )
  }

  public setValue(fqPropertyName: FQPropertyName, value: unknown): void {
    if (Object.is(this.getValue(fqPropertyName), value)) {
      return
    }

    this.applyEntry(fqPropertyName, value)
  }

  public emitEvent(fqEventName: FQPropertyName, payload: object): void {
    if (!this.pendingTransients) {
      this.pendingTransients = new Set()
    }

    this.pendingTransients.add(fqEventName)

    this.applyEntry(fqEventName, payload)
  }

  private applyEntry(fqPropertyName: FQPropertyName, value: unknown): void {
    const outermost = this.propagating === null

    if (outermost) {
      this.propagating = new Set()
    }

    try {
      this.applyWrite(fqPropertyName, value)
    } finally {
      if (outermost) {
        this.propagating = null

        const transients = this.pendingTransients

        this.pendingTransients = null

        if (transients) {
          for (const item of transients) {
            this.clearTransientData(item)
          }
        }

        const releases = this.pendingReleases

        this.pendingReleases = null

        if (releases) {
          for (const item of releases) {
            this.releaseIfUnused(item)
          }
        }
      }
    }
  }

  private applyWrite(fqPropertyName: FQPropertyName, value: unknown): void {
    if (this.propagating!.has(fqPropertyName)) {
      return
    }

    this.propagating!.add(fqPropertyName)

    const component = getComponentName(fqPropertyName)
    const segments = getPropertySegments(getPropertyName(fqPropertyName))

    let root = this.data.get(component)

    if (!root) {
      root = {}
      this.data.set(component, root)
    }

    // Interest nodes carry their own `fq` and `segments`, so collect the nodes
    // directly rather than allocating a wrapper per interested node per write.
    const ancestors: InterestNode[] = []
    const subtree: InterestNode[] = []

    const interestRoot = this.interestRoots.get(component)

    if (interestRoot) {
      let cursor: InterestNode | null = interestRoot

      for (let i = 0; cursor && i < segments.length; i++) {
        if (cursor.subscribers > 0 || cursor.bindings.size > 0) {
          ancestors.push(cursor)
        }

        cursor = cursor.children.get(segments[i]) ?? null
      }

      if (cursor) {
        const stack: InterestNode[] = [cursor]

        while (stack.length) {
          const node = stack.pop()!

          if (node.subscribers > 0 || node.bindings.size > 0) {
            subtree.push(node)
          }

          for (const child of node.children.values()) {
            stack.push(child)
          }
        }
      }
    }

    const subtreeOldValues: unknown[] = new Array(subtree.length)

    for (let i = 0; i < subtree.length; i++) {
      subtreeOldValues[i] = readAtPath(root, subtree[i].segments)
    }

    writeAtPath(root, segments, value)

    for (let i = 0; i < subtree.length; i++) {
      const node = subtree[i]
      const newValue = readAtPath(root, node.segments)

      if (Object.is(subtreeOldValues[i], newValue)) {
        continue
      }

      this.emitAt(node.fq, node, newValue, subtreeOldValues[i])
    }

    // Ancestor references mutate in place; pass current as both old and new.
    // Subscribers receive a notification that "something changed below me".
    for (const node of ancestors) {
      const currentValue = readAtPath(root, node.segments)

      this.emitAt(node.fq, node, currentValue, currentValue)
    }
  }

  private emitAt(fq: FQPropertyName, node: InterestNode, newValue: unknown, oldValue: unknown): void {
    if (node.subscribers > 0) {
      this.changedEmitter.emit(fq, newValue, oldValue)
    }

    for (const neighbor of node.bindings) {
      this.applyWrite(neighbor, newValue)
    }
  }

  private clearTransientData(fqPropertyName: FQPropertyName): void {
    const component = getComponentName(fqPropertyName)
    const root = this.data.get(component)

    if (!root) {
      return
    }

    const segments = getPropertySegments(getPropertyName(fqPropertyName))

    deleteAtPath(root, segments)

    for (let depth = segments.length - 1; depth >= 1; depth--) {
      const parentSegments = segments.slice(0, depth)
      const parent = readAtPath(root, parentSegments)

      if (!isObject(parent) || Object.keys(parent).length > 0) {
        break
      }

      deleteAtPath(root, parentSegments)
    }

    if (Object.keys(root).length === 0 && !this.interestRoots.has(component)) {
      this.data.delete(component)
    }
  }

  private ensureInterestNode(fq: FQPropertyName): InterestNode {
    const component = getComponentName(fq)
    const segments = getPropertySegments(getPropertyName(fq))

    let current: InterestNode | undefined = this.interestRoots.get(component)

    if (!current) {
      current = {
        parent: null,
        segment: "",
        segments: [],
        fq: joinFQPropertyName(component, ""),
        children: new Map(),
        bindings: new Set(),
        subscribers: 0,
      }
      this.interestRoots.set(component, current)
    }

    for (const segment of segments) {
      let child: InterestNode | undefined = current.children.get(segment)

      if (!child) {
        const childSegments: string[] = [...current.segments, segment]

        child = {
          parent: current,
          segment,
          segments: childSegments,
          fq: joinFQPropertyName(component, childSegments.join(PROPERTY_NAME_SEGMENT_SEPARATOR)),
          children: new Map(),
          bindings: new Set(),
          subscribers: 0,
        }
        current.children.set(segment, child)
      }

      current = child
    }

    return current
  }

  private findInterestNode(fq: FQPropertyName): InterestNode | null {
    const component = getComponentName(fq)
    const segments = getPropertySegments(getPropertyName(fq))

    let current = this.interestRoots.get(component)

    for (let i = 0; current && i < segments.length; i++) {
      current = current.children.get(segments[i])
    }

    return current ?? null
  }

  private scheduleRelease(fq: FQPropertyName): void {
    if (this.propagating !== null) {
      if (!this.pendingReleases) {
        this.pendingReleases = new Set()
      }

      this.pendingReleases.add(fq)

      return
    }

    this.releaseIfUnused(fq)
  }

  private releaseIfUnused(fq: FQPropertyName): void {
    const component = getComponentName(fq)
    const interestRoot = this.interestRoots.get(component)

    if (!interestRoot) {
      return
    }

    let node = this.findInterestNode(fq)

    if (!node) {
      return
    }

    const dataRoot = this.data.get(component)
    const pathStack = [...getPropertySegments(getPropertyName(fq))]

    while (node && node !== interestRoot && !hasInterest(node)) {
      const parent: InterestNode | null = node.parent

      if (!parent) {
        break
      }

      parent.children.delete(node.segment)

      if (dataRoot) {
        deleteAtPath(dataRoot, pathStack)
      }

      pathStack.pop()
      node = parent
    }

    if (!hasInterest(interestRoot)) {
      this.interestRoots.delete(component)

      if (dataRoot && Object.keys(dataRoot).length === 0) {
        this.data.delete(component)
      }
    }
  }

  private readonly changedOnInterceptor = (fq: FQPropertyName, handler: StateChangedHandler): void => {
    if (this.changedEmitter.handlers.get(fq)?.has(handler)) {
      return
    }

    this.ensureInterestNode(fq).subscribers++
  }

  private readonly changedOffInterceptor = (fq: FQPropertyName, handler: StateChangedHandler): void => {
    const node = this.findInterestNode(fq)

    if (!node || !this.changedEmitter.handlers.get(fq)?.has(handler)) {
      return
    }

    node.subscribers--

    this.scheduleRelease(fq)
  }
}
