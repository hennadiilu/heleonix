import type { IQualifierArg } from "@heleonix/hx-language"

/**
 * A style-qualifier TypeScript class found by the analyzer's class scan (a class
 * extending `StyleQualifier<TArgs>`). `name` is the rule-key segment name (the
 * class name minus its required `Qualifier` suffix, e.g. `IfQualifier` -> `If`);
 * `suffixOk` is false when the suffix is missing. `args` are the resolved
 * members of `TArgs`, each carrying an optional branded `refKind`.
 */
export interface IDiscoveredQualifier {
  className: string

  name: string

  suffixOk: boolean

  file: string

  /** Zero-based line/character of the class name, for go-to-implementation. */
  line: number

  character: number

  /** The class's summary doc comment, if any. */
  docs?: string

  args: IQualifierArg[]
}
