import type { FQDictionaryEntryName } from "@heleonix/hx-language"
import { FrameworkElement } from "../FrameworkElement"
import { BindingEvaluator } from "../bindings/BindingEvaluator"

/**
 * Read-only access to interpolated dictionary values. The interpolation itself
 * is expression evaluation over a template, so it lives in the one
 * {@link BindingEvaluator}; this facade exists so converters and actions can get
 * a dictionary value without reaching for the evaluator's full binding surface.
 */
export class DictionaryProvider extends FrameworkElement<BindingEvaluator> {
  private readonly evaluator = this.inject(BindingEvaluator)

  public static get diName(): string {
    return "DictionaryProvider"
  }

  public getValue(path: FQDictionaryEntryName, parameterGetter: (raw: string) => unknown): Promise<string | undefined> {
    return this.evaluator.getDictionaryValue(path, parameterGetter)
  }
}
