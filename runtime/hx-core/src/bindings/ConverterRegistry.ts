import { FrameworkElement } from "../FrameworkElement"
import type { Converter } from "../converters/Converter"
import type { InjectableType } from "../injection/InjectableType"

const CONVERTER_SUFFIX = "Converter"

/**
 * Resolves a converter by its binding name (`Truncate` -> `TruncateConverter`
 * DI token). The single owner of the `Converter`-suffix convention, injected by
 * the {@link BindingEvaluator} so nothing else repeats the lookup. Resolution is
 * lazy and per-call, so the evaluator holds no static converter instance and a
 * converter that reads a dictionary is only ever constructed on demand.
 */
export class ConverterRegistry extends FrameworkElement<Converter> {
  public static get diName(): string {
    return "ConverterRegistry"
  }

  public get(name: string): Converter {
    return this.inject({
      diName: `${name}${CONVERTER_SUFFIX}`,
      isSingleton: true,
    } as unknown as InjectableType<Converter>)
  }
}
