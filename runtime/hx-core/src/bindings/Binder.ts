import { FrameworkElement } from "../FrameworkElement"
import { collectStateParameters, joinFQPropertyName } from "@heleonix/hx-language"
import type { FQComponentName, FQPropertyName, IBindingExpression } from "@heleonix/hx-language"
import { StateManager } from "../state/StateManager"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import { BindingEvaluator } from "./BindingEvaluator"

interface BindingRecord {
  binding: IBindingExpression
  scopeFQ: FQComponentName
  targetFQ: FQPropertyName
  // Fully-qualified state paths whose change re-runs `format` (source + args, or
  // a dictionary template's parameters).
  formatParams: FQPropertyName[]
  // The writable source path `parse` writes back to, set only for a two-way
  // state source behind a converter chain.
  sourceFQ?: FQPropertyName
  // A dictionary entry may resolve to `undefined` while its definition loads;
  // unlike a converter result, that must not overwrite the target.
  skipUndefined: boolean
  formatHandler: () => void
  parseHandler: () => void
  // Re-entrancy guard: true only while this record writes, so its own writes
  // never trigger its opposite direction (self-echo).
  writing: boolean
}

/**
 * The single owner of property-binding lifecycle. Given a target property, its
 * binding expression, and the scope its sources resolve against - the enclosing
 * declarative component that wrote the usage, so state paths, converter
 * arguments and dictionary interpolation parameters all resolve the same way -
 * it picks the cheapest correct strategy: a symmetric state-edge alias for a
 * bare state source, a one-shot write for a literal or config value, and a
 * reactive record (subscribe -> `format` -> write, plus two-way `parse` when the
 * source is writable state) for dictionary and converter bindings. All
 * expression semantics go through the one {@link BindingEvaluator}; this element
 * owns only subscription, direction and write-back. Re-resolving a binding on a
 * dimension switch is driven by the component reconcile (which already walks the
 * tree then), through {@link refresh} - not a subscription here.
 */
export class Binder extends FrameworkElement<StateManager | BindingEvaluator> {
  private readonly stateManager = this.inject(StateManager)

  private readonly evaluator = this.inject(BindingEvaluator)

  private readonly records = new Map<FQPropertyName, BindingRecord>()

  private readonly edges = new Map<FQPropertyName, FQPropertyName>()

  public static get diName(): string {
    return "Binder"
  }

  public async bind(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): Promise<void> {
    this.unbind(targetFQ)

    if (!binding.converters?.length) {
      switch (binding.type) {
        case "state":
          this.bindStateEdge(targetFQ, joinFQPropertyName(scopeFQ, binding.value))

          return
        case "literal":
          this.stateManager.setValue(targetFQ, JSON.parse(binding.value))

          return
        case "config":
          await this.bindConfig(targetFQ, binding)

          return
        case "dictionary":
          await this.bindReactive(
            targetFQ,
            binding,
            scopeFQ,
            collectStateParameters(await this.requireEntry(binding)),
            true,
          )

          return
      }
    }

    await this.bindReactive(targetFQ, binding, scopeFQ, this.evaluator.getDependencies(binding), false)
  }

  public unbind(targetFQ: FQPropertyName): void {
    const record = this.records.get(targetFQ)

    if (record) {
      for (const paramFQ of record.formatParams) {
        this.stateManager.changed.off(paramFQ, record.formatHandler)
      }

      if (record.sourceFQ !== undefined) {
        this.stateManager.changed.off(record.targetFQ, record.parseHandler)
      }

      this.records.delete(targetFQ)

      return
    }

    const edgeSource = this.edges.get(targetFQ)

    if (edgeSource !== undefined) {
      this.stateManager.unbind(targetFQ, edgeSource)
      this.edges.delete(targetFQ)
    }
  }

  /**
   * Re-resolves a binding that survived a reconcile unchanged, but only when its
   * value derives from a dimension-selected dictionary or config - those are the
   * bindings whose value can change without their expression text changing. A
   * full rebind (not just re-format) because a dictionary template's parameters
   * can differ across dimensions. State/literal bindings are left untouched.
   */
  public refresh(targetFQ: FQPropertyName, binding: IBindingExpression, scopeFQ: FQComponentName): void {
    if (this.evaluator.isDimensionSensitive(binding)) {
      void this.bind(targetFQ, binding, scopeFQ)
    }
  }

  private bindStateEdge(targetFQ: FQPropertyName, sourceFQ: FQPropertyName): void {
    this.stateManager.bind(targetFQ, sourceFQ)
    this.edges.set(targetFQ, sourceFQ)
  }

  private async bindConfig(targetFQ: FQPropertyName, binding: IBindingExpression): Promise<void> {
    // Config carries no state dependencies, so the evaluator needs no getter.
    const value = await this.evaluator.resolve(binding, () => undefined)

    if (value === undefined) {
      throw new HeleonixError(Errors.configEntryRetrieval, binding.value)
    }

    this.stateManager.setValue(targetFQ, value)
  }

  private async requireEntry(binding: IBindingExpression): Promise<string> {
    const template = await this.evaluator.getDictionaryEntry(binding.value)

    if (template === undefined) {
      throw new HeleonixError(Errors.dictionaryEntryRetrieval, binding.value)
    }

    return template
  }

  private async bindReactive(
    targetFQ: FQPropertyName,
    binding: IBindingExpression,
    scopeFQ: FQComponentName,
    params: string[],
    skipUndefined: boolean,
  ): Promise<void> {
    const sourceFQ = binding.type === "state" && binding.value ? joinFQPropertyName(scopeFQ, binding.value) : undefined

    await this.startRecord(this.createRecord(targetFQ, binding, scopeFQ, params, sourceFQ, skipUndefined))
  }

  private createRecord(
    targetFQ: FQPropertyName,
    binding: IBindingExpression,
    scopeFQ: FQComponentName,
    params: string[],
    sourceFQ: FQPropertyName | undefined,
    skipUndefined: boolean,
  ): BindingRecord {
    const record: BindingRecord = {
      binding,
      scopeFQ,
      targetFQ,
      formatParams: params.map((param) => joinFQPropertyName(scopeFQ, param)),
      sourceFQ,
      skipUndefined,
      writing: false,
      formatHandler: () => void this.format(record),
      parseHandler: () => void this.parse(record),
    }

    return record
  }

  private async startRecord(record: BindingRecord): Promise<void> {
    for (const paramFQ of record.formatParams) {
      this.stateManager.changed.on(paramFQ, record.formatHandler)
    }

    if (record.sourceFQ !== undefined) {
      this.stateManager.changed.on(record.targetFQ, record.parseHandler)
    }

    this.records.set(record.targetFQ, record)

    await this.format(record)
  }

  private getter(record: BindingRecord): (path: string) => unknown {
    return (param) => this.stateManager.getValue(joinFQPropertyName(record.scopeFQ, param))
  }

  private async format(record: BindingRecord): Promise<void> {
    if (record.writing) {
      return
    }

    const value = await this.evaluator.resolve(record.binding, this.getter(record))

    if (record.skipUndefined && value === undefined) {
      return
    }

    this.write(record, record.targetFQ, value)
  }

  private async parse(record: BindingRecord): Promise<void> {
    if (record.writing || record.sourceFQ === undefined) {
      return
    }

    const targetValue = this.stateManager.getValue(record.targetFQ)
    const value = await this.evaluator.resolveBack(targetValue, record.binding, this.getter(record))

    this.write(record, record.sourceFQ, value)
  }

  private write(record: BindingRecord, fq: FQPropertyName, value: unknown): void {
    record.writing = true
    this.stateManager.setValue(fq, value)
    record.writing = false
  }
}
