import {
  EXPRESSION_PATTERN,
  joinFQPropertyName,
  parseBindingExpression,
  parseConverterCall,
} from "@heleonix/hx-language"
import type { BindingType, FQComponentName, FQPropertyName, IBindingExpression } from "@heleonix/hx-language"
import type { MaybePromise } from "../common/MaybePromise"
import { isThenable } from "../common/isThenable"
import { thenMaybe } from "../common/thenMaybe"
import type { IConverterProvider } from "../converters/IConverterProvider"
import type { IValueSource } from "./IValueSource"

const EXPRESSION_REGEX = new RegExp(EXPRESSION_PATTERN, "g")

const EMPTY_ARGS: Record<string, unknown> = Object.freeze({})

const LEAF_TYPES: ReadonlySet<BindingType> = new Set<BindingType>(["state", "literal"])

type ConverterCall = ReturnType<typeof parseConverterCall>

export class BindingEvaluator {
  private readonly sources: Map<BindingType, IValueSource>

  private readonly argEntries = new WeakMap<ConverterCall, [string, IBindingExpression][]>()

  public constructor(
    private readonly converters: IConverterProvider,
    sources: readonly IValueSource[],
  ) {
    this.sources = new Map(sources.map((source) => [source.type, source]))
  }

  public resolve(binding: IBindingExpression, scopeFQ: FQComponentName): MaybePromise<unknown> {
    return this.applyFormat(this.resolveSource(binding, scopeFQ), binding.converters ?? [], 0, scopeFQ)
  }

  public resolveBack(
    targetValue: unknown,
    binding: IBindingExpression,
    scopeFQ: FQComponentName,
  ): MaybePromise<unknown> {
    const converters = binding.converters ?? []

    return this.applyParse(targetValue, converters, converters.length - 1, scopeFQ)
  }

  public collectParameters(binding: IBindingExpression, scopeFQ: FQComponentName): MaybePromise<FQPropertyName[]> {
    const params = new Set<FQPropertyName>()

    return thenMaybe(this.collectInto(binding, scopeFQ, params), () => [...params])
  }

  public isDimensionSensitive(binding: IBindingExpression): boolean {
    if (binding.type === "dictionary" || binding.type === "config") {
      return true
    }

    for (const segment of binding.converters ?? []) {
      for (const expression of Object.values(parseConverterCall(segment).args)) {
        if (expression.type === "dictionary" || expression.type === "config") {
          return true
        }
      }
    }

    return false
  }

  private applyFormat(
    value: MaybePromise<unknown>,
    converters: readonly string[],
    index: number,
    scopeFQ: FQComponentName,
  ): MaybePromise<unknown> {
    while (index < converters.length) {
      if (isThenable(value)) {
        const next = index

        return value.then((source) => this.applyFormat(source, converters, next, scopeFQ))
      }

      const call = parseConverterCall(converters[index])
      const args = this.resolveArgs(call, scopeFQ)
      const source = value
      const next = index + 1

      if (isThenable(args)) {
        return args.then((resolved) =>
          this.applyFormat(this.converters.get(call.name).format(source, resolved), converters, next, scopeFQ),
        )
      }

      value = this.converters.get(call.name).format(source, args)
      index = next
    }

    return value
  }

  private applyParse(
    value: MaybePromise<unknown>,
    converters: readonly string[],
    index: number,
    scopeFQ: FQComponentName,
  ): MaybePromise<unknown> {
    while (index >= 0) {
      if (isThenable(value)) {
        const next = index

        return value.then((target) => this.applyParse(target, converters, next, scopeFQ))
      }

      const call = parseConverterCall(converters[index])
      const args = this.resolveArgs(call, scopeFQ)
      const target = value
      const next = index - 1

      if (isThenable(args)) {
        return args.then((resolved) =>
          this.applyParse(this.converters.get(call.name).parse(target, resolved), converters, next, scopeFQ),
        )
      }

      value = this.converters.get(call.name).parse(target, args)
      index = next
    }

    return value
  }

  private resolveSource(expression: IBindingExpression, scopeFQ: FQComponentName): MaybePromise<unknown> {
    const source = this.sources.get(expression.type)

    if (!source) {
      return undefined
    }

    const raw = source.get(this.pathFor(expression, scopeFQ))

    return LEAF_TYPES.has(expression.type) ? raw : this.interpolateMaybe(raw, scopeFQ)
  }

  private interpolateMaybe(raw: MaybePromise<unknown>, scopeFQ: FQComponentName): MaybePromise<unknown> {
    if (isThenable(raw)) {
      return raw.then((value) => this.interpolateMaybe(value, scopeFQ))
    }

    return typeof raw === "string" ? this.interpolate(raw, scopeFQ) : raw
  }

  private async interpolate(template: string, scopeFQ: FQComponentName): Promise<string> {
    let result = ""
    let lastIndex = 0

    for (const match of template.matchAll(EXPRESSION_REGEX)) {
      result += template.slice(lastIndex, match.index)
      result += String(await this.resolve(parseBindingExpression(match[1]), scopeFQ))
      lastIndex = match.index + match[0].length
    }

    return result + template.slice(lastIndex)
  }

  private collectInto(
    expression: IBindingExpression,
    scopeFQ: FQComponentName,
    params: Set<FQPropertyName>,
  ): MaybePromise<void> {
    let sourcePart: MaybePromise<void> = undefined

    if (expression.type === "state") {
      if (expression.value) {
        params.add(joinFQPropertyName(scopeFQ, expression.value))
      }
    } else if (!LEAF_TYPES.has(expression.type)) {
      const source = this.sources.get(expression.type)

      if (source) {
        sourcePart = this.collectFromTemplate(source.get(this.pathFor(expression, scopeFQ)), scopeFQ, params)
      }
    }

    return thenMaybe(sourcePart, () => this.collectArgs(expression, scopeFQ, params))
  }

  private collectFromTemplate(
    raw: MaybePromise<unknown>,
    scopeFQ: FQComponentName,
    params: Set<FQPropertyName>,
  ): MaybePromise<void> {
    if (isThenable(raw)) {
      return raw.then((value) => this.collectFromTemplate(value, scopeFQ, params))
    }

    if (typeof raw !== "string") {
      return undefined
    }

    let chain: MaybePromise<void> = undefined

    for (const match of raw.matchAll(EXPRESSION_REGEX)) {
      const inner = match[1]

      chain = thenMaybe(chain, () => this.collectInto(parseBindingExpression(inner), scopeFQ, params))
    }

    return chain
  }

  private collectArgs(
    expression: IBindingExpression,
    scopeFQ: FQComponentName,
    params: Set<FQPropertyName>,
  ): MaybePromise<void> {
    let chain: MaybePromise<void> = undefined

    for (const segment of expression.converters ?? []) {
      for (const argExpression of Object.values(parseConverterCall(segment).args)) {
        chain = thenMaybe(chain, () => this.collectInto(argExpression, scopeFQ, params))
      }
    }

    return chain
  }

  private pathFor(expression: IBindingExpression, scopeFQ: FQComponentName): string {
    return expression.type === "state" ? joinFQPropertyName(scopeFQ, expression.value) : expression.value
  }

  private resolveArgs(call: ConverterCall, scopeFQ: FQComponentName): MaybePromise<Record<string, unknown>> {
    let entries = this.argEntries.get(call)

    if (entries === undefined) {
      entries = Object.entries(call.args)
      this.argEntries.set(call, entries)
    }

    if (entries.length === 0) {
      return EMPTY_ARGS
    }

    const args: Record<string, unknown> = {}
    let pending: Promise<void>[] | undefined

    for (const [name, expression] of entries) {
      const value = this.resolveSource(expression, scopeFQ)

      if (isThenable(value)) {
        ;(pending ??= []).push(value.then((resolved) => void (args[name] = resolved)))
      } else {
        args[name] = value
      }
    }

    return pending ? Promise.all(pending).then(() => args) : args
  }
}
