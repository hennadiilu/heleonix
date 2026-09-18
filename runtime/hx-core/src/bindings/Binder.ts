import { getComponentName, getPropertyName, joinFQPropertyName } from "@heleonix/hx-language"
import type { FQComponentName, FQPropertyName, IBindingExpression } from "@heleonix/hx-language"
import { StateManager } from "../state/StateManager"
import type { MaybePromise } from "../common/MaybePromise"
import { isThenable } from "../common/isThenable"
import { thenMaybe } from "../common/thenMaybe"
import { KeyedEventEmitter } from "../common/KeyedEventEmitter"
import type { IKeyedEventEmitter } from "../common/IKeyedEventEmitter"
import type { IClearable } from "../common/IClearable"
import { BindingEvaluator } from "./BindingEvaluator"
import type { BindingEndpointHandler } from "./BindingEndpointHandler"
import type { IBinder } from "./IBinder"

const EMPTY_ENDPOINTS: readonly string[] = Object.freeze([])

interface BindingRecord {
  binding: IBindingExpression

  scopeFQ: FQComponentName

  targetFQ: FQPropertyName

  formatParams: FQPropertyName[]

  sourceFQ?: FQPropertyName

  skipUndefined: boolean

  formatHandler: () => void

  parseHandler?: () => void

  writing: boolean
}

export class Binder implements IBinder, IClearable {
  private readonly records = new Map<FQPropertyName, BindingRecord>()

  private readonly edges = new Map<FQPropertyName, FQPropertyName>()

  private readonly endpointsByTarget = new Map<FQPropertyName, ReadonlySet<FQPropertyName>>()

  private readonly endpointCounts = new Map<FQComponentName, Map<string, number>>()

  private readonly endpointActivatedEmitter = new KeyedEventEmitter<FQComponentName, BindingEndpointHandler>()

  private readonly endpointDeactivatedEmitter = new KeyedEventEmitter<FQComponentName, BindingEndpointHandler>()

  public constructor(
    private readonly state: StateManager,
    private readonly evaluator: BindingEvaluator,
  ) {}

  public get endpointActivated(): IKeyedEventEmitter<FQComponentName, BindingEndpointHandler> {
    return this.endpointActivatedEmitter
  }

  public get endpointDeactivated(): IKeyedEventEmitter<FQComponentName, BindingEndpointHandler> {
    return this.endpointDeactivatedEmitter
  }

  public clear(): void {
    this.records.clear()
    this.edges.clear()
    this.endpointsByTarget.clear()
    this.endpointCounts.clear()
    this.endpointActivatedEmitter.clear()
    this.endpointDeactivatedEmitter.clear()
  }

  public bind(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): MaybePromise<void> {
    // The previous binding's machinery goes now, but its endpoints stay
    // registered until the new set replaces them in one diff, so a path both
    // bindings reach - the event a dimension switch keeps - never deactivates
    // in between, not even across the async resolve of the new parameters.
    this.teardown(targetFQ)

    if (!binding.converters?.length) {
      if (binding.type === "state") {
        return this.bindStateEdge(targetFQ, joinFQPropertyName(scopeFQ, binding.value))
      }

      if (binding.type === "literal") {
        this.setEndpoints(targetFQ, EMPTY_ENDPOINTS)

        return this.state.setValue(targetFQ, JSON.parse(binding.value))
      }
    }

    return this.bindReactive(targetFQ, binding, scopeFQ)
  }

  public unbind(targetFQ: FQPropertyName): void {
    this.teardown(targetFQ)
    this.setEndpoints(targetFQ, EMPTY_ENDPOINTS)
  }

  public rebind(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): void {
    if (this.evaluator.isDimensionSensitive(binding)) {
      void this.bind(targetFQ, binding, scopeFQ)
    }
  }

  public getActiveEndpoints(componentFQ: FQComponentName): readonly string[] {
    const paths = this.endpointCounts.get(componentFQ)

    return paths ? [...paths.keys()] : EMPTY_ENDPOINTS
  }

  private teardown(targetFQ: FQPropertyName): void {
    const record = this.records.get(targetFQ)

    if (record) {
      for (const paramFQ of record.formatParams) {
        this.state.changed.off(paramFQ, record.formatHandler)
      }

      if (record.parseHandler) {
        this.state.changed.off(record.targetFQ, record.parseHandler)
      }

      this.records.delete(targetFQ)

      return
    }

    const edgeSource = this.edges.get(targetFQ)

    if (edgeSource !== undefined) {
      this.state.unbind(targetFQ, edgeSource)
      this.edges.delete(targetFQ)
    }
  }

  private bindStateEdge(targetFQ: FQPropertyName, sourceFQ: FQPropertyName): void {
    this.state.bind(targetFQ, sourceFQ)
    this.edges.set(targetFQ, sourceFQ)

    this.setEndpoints(targetFQ, [targetFQ, sourceFQ])
  }

  private setEndpoints(targetFQ: FQPropertyName, endpoints: readonly FQPropertyName[]): void {
    const previous = this.endpointsByTarget.get(targetFQ)
    const next = endpoints.length > 0 ? new Set(endpoints) : undefined

    if (next) {
      this.endpointsByTarget.set(targetFQ, next)

      for (const endpoint of next) {
        if (!previous?.has(endpoint)) {
          this.acquireEndpoint(endpoint)
        }
      }
    } else {
      this.endpointsByTarget.delete(targetFQ)
    }

    for (const endpoint of previous ?? []) {
      if (!next?.has(endpoint)) {
        this.releaseEndpoint(endpoint)
      }
    }
  }

  private acquireEndpoint(endpoint: FQPropertyName): void {
    const localPath = getPropertyName(endpoint)

    if (!localPath) {
      return
    }

    const componentFQ = getComponentName(endpoint)

    let paths = this.endpointCounts.get(componentFQ)

    if (!paths) {
      paths = new Map<string, number>()

      this.endpointCounts.set(componentFQ, paths)
    }

    const count = paths.get(localPath) ?? 0

    paths.set(localPath, count + 1)

    if (count === 0) {
      this.endpointActivatedEmitter.emit(componentFQ, localPath)
    }
  }

  private releaseEndpoint(endpoint: FQPropertyName): void {
    const localPath = getPropertyName(endpoint)
    const componentFQ = getComponentName(endpoint)
    const paths = this.endpointCounts.get(componentFQ)
    const count = paths?.get(localPath)

    if (!paths || !count) {
      return
    }

    if (count > 1) {
      paths.set(localPath, count - 1)

      return
    }

    paths.delete(localPath)

    if (paths.size === 0) {
      this.endpointCounts.delete(componentFQ)
    }

    this.endpointDeactivatedEmitter.emit(componentFQ, localPath)
  }

  private bindReactive(
    targetFQ: FQPropertyName,
    binding: IBindingExpression,
    scopeFQ: FQComponentName,
  ): MaybePromise<void> {
    return thenMaybe(this.evaluator.collectParameters(binding, scopeFQ), (params) =>
      this.startRecord(this.createRecord(targetFQ, binding, scopeFQ, params)),
    )
  }

  private createRecord(
    targetFQ: FQPropertyName,
    binding: IBindingExpression,
    scopeFQ: FQComponentName,
    params: FQPropertyName[],
  ): BindingRecord {
    const sourceFQ = binding.type === "state" && binding.value ? joinFQPropertyName(scopeFQ, binding.value) : undefined

    const record: BindingRecord = {
      binding,
      scopeFQ,
      targetFQ,
      formatParams: params,
      sourceFQ,
      skipUndefined: binding.type !== "state" && binding.type !== "literal",
      writing: false,
      formatHandler: () => this.runFormat(record),
      parseHandler: sourceFQ !== undefined ? () => this.runParse(record) : undefined,
    }

    return record
  }

  private startRecord(record: BindingRecord): MaybePromise<void> {
    for (const paramFQ of record.formatParams) {
      this.state.changed.on(paramFQ, record.formatHandler)
    }

    if (record.parseHandler) {
      this.state.changed.on(record.targetFQ, record.parseHandler)
    }

    this.records.set(record.targetFQ, record)

    // A state source is collected as a parameter, so `sourceFQ` is already here.
    this.setEndpoints(record.targetFQ, [record.targetFQ, ...record.formatParams])

    return this.format(record)
  }

  private runFormat(record: BindingRecord): void {
    try {
      void this.format(record)
    } catch (error) {
      void Promise.resolve().then(() => {
        throw error
      })
    }
  }

  private runParse(record: BindingRecord): void {
    try {
      void this.parse(record)
    } catch (error) {
      void Promise.resolve().then(() => {
        throw error
      })
    }
  }

  private format(record: BindingRecord): MaybePromise<void> {
    if (record.writing) {
      return
    }

    const value = this.evaluator.resolve(record.binding, record.scopeFQ)

    if (isThenable(value)) {
      return value.then((resolved) => this.writeFormatted(record, resolved))
    }

    this.writeFormatted(record, value)
  }

  private writeFormatted(record: BindingRecord, value: unknown): void {
    if (record.skipUndefined && value === undefined) {
      return
    }

    this.write(record, record.targetFQ, value)
  }

  private parse(record: BindingRecord): MaybePromise<void> {
    const sourceFQ = record.sourceFQ

    if (record.writing || sourceFQ === undefined) {
      return
    }

    const value = this.evaluator.resolveBack(this.state.getValue(record.targetFQ), record.binding, record.scopeFQ)

    if (isThenable(value)) {
      return value.then((resolved) => this.write(record, sourceFQ, resolved))
    }

    this.write(record, sourceFQ, value)
  }

  private write(record: BindingRecord, fq: FQPropertyName, value: unknown): void {
    record.writing = true
    this.state.setValue(fq, value)
    record.writing = false
  }
}
