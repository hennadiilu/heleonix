import {
  DICTIONARY_ENTRY_SEPARATOR,
  EXPRESSION_PATTERN,
  FQDictionaryEntryName,
  parseBindingExpression,
  parseConverterCall,
} from "@heleonix/hx-language"
import type { IBindingExpression } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"
import { ConfigDefinitionProvider } from "../configs/ConfigDefinitionProvider"
import { resolveConfigEntry } from "../configs/resolveConfigEntry"
import { DictionaryDefinitionProvider } from "../dictionaries/DictionaryDefinitionProvider"
import { ConverterRegistry } from "./ConverterRegistry"

/**
 * The single owner of binding-expression semantics: resolving a source, running
 * a converter `format`/`parse` chain, interpolating a dictionary template, and
 * listing the state paths a binding depends on. Both component-property bindings
 * and dictionary-entry interpolations go through this one implementation, so the
 * two can never drift. State is read through the caller-supplied `get` (a scoped
 * path -> value lookup); every other source kind is resolved here against the
 * config and dictionary layers. Converters are pulled per-call from the
 * {@link ConverterRegistry} so this element never depends on them statically.
 */
export class BindingEvaluator extends FrameworkElement<
  ConfigDefinitionProvider | DictionaryDefinitionProvider | ConverterRegistry
> {
  private readonly configDefinitionProvider = this.inject(ConfigDefinitionProvider)

  private readonly dictionaryDefinitionProvider = this.inject(DictionaryDefinitionProvider)

  private readonly converters = this.inject(ConverterRegistry)

  public static get diName(): string {
    return "BindingEvaluator"
  }

  public async resolve(binding: IBindingExpression, get: (path: string) => unknown): Promise<unknown> {
    let value = await this.resolveSource(binding, get)

    for (const segment of binding.converters ?? []) {
      const call = parseConverterCall(segment)

      value = await this.converters.get(call.name).format(value, await this.resolveArgs(call, get))
    }

    return value
  }

  public async resolveBack(
    targetValue: unknown,
    binding: IBindingExpression,
    get: (path: string) => unknown,
  ): Promise<unknown> {
    const converters = binding.converters ?? []
    let value = targetValue

    for (let index = converters.length - 1; index >= 0; index--) {
      const call = parseConverterCall(converters[index])

      value = await this.converters.get(call.name).parse(value, await this.resolveArgs(call, get))
    }

    return value
  }

  public async getDictionaryValue(
    path: FQDictionaryEntryName,
    get: (path: string) => unknown,
  ): Promise<string | undefined> {
    const template = await this.getDictionaryEntry(path)

    if (template === undefined) {
      return undefined
    }

    return this.interpolate(template, get)
  }

  public async getDictionaryEntry(path: FQDictionaryEntryName): Promise<string | undefined> {
    const splitIndex = path.lastIndexOf(DICTIONARY_ENTRY_SEPARATOR)
    const name = path.slice(0, splitIndex)

    const definition = await this.dictionaryDefinitionProvider.getDefinition(name)

    if (!definition) {
      throw new HeleonixError(Errors.dictionaryDefinitionProviding, name)
    }

    return definition.entries[path.slice(splitIndex + 1)]
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

  public getDependencies(binding: IBindingExpression): string[] {
    const params: string[] = []

    if (binding.type === "state" && binding.value) {
      params.push(binding.value)
    }

    for (const segment of binding.converters ?? []) {
      for (const expression of Object.values(parseConverterCall(segment).args)) {
        if (expression.type === "state" && expression.value) {
          params.push(expression.value)
        }
      }
    }

    return params
  }

  private async resolveSource(expression: IBindingExpression, get: (path: string) => unknown): Promise<unknown> {
    switch (expression.type) {
      case "state":
        return get(expression.value)
      case "literal":
        return JSON.parse(expression.value)
      case "config":
        return resolveConfigEntry(this.configDefinitionProvider, expression.value)
      case "dictionary":
        return this.getDictionaryValue(expression.value, get)
      default:
        return undefined
    }
  }

  private async resolveArgs(
    call: ReturnType<typeof parseConverterCall>,
    get: (path: string) => unknown,
  ): Promise<Record<string, unknown>> {
    const args: Record<string, unknown> = {}

    for (const [name, expression] of Object.entries(call.args)) {
      args[name] = await this.resolveSource(expression, get)
    }

    return args
  }

  private async interpolate(template: string, get: (path: string) => unknown): Promise<string> {
    const pattern = new RegExp(EXPRESSION_PATTERN, "g")

    let result = ""
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(template)) !== null) {
      result += template.slice(lastIndex, match.index)
      result += String(await this.resolve(parseBindingExpression(match[1]), get))
      lastIndex = match.index + match[0].length
    }

    return result + template.slice(lastIndex)
  }
}
