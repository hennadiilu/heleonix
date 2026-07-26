import type { IMemberType } from "./IMemberType"

/**
 * A converter/action TypeScript class found by the analyzer's class scan.
 * `name` is the binding/registry name (the class name minus its required
 * `Converter`/`Action` suffix); `suffixOk` is false when the suffix is missing
 * (a diagnostic). `params` are the resolved `TParams` members.
 */
export interface IDiscoveredClass {
  className: string

  base: "Converter" | "Action"

  name: string

  suffixOk: boolean

  file: string

  /** Zero-based line/character of the class name, for go-to-implementation. */
  line: number

  character: number

  /** The class's summary doc comment, if any. */
  docs?: string

  params: IMemberType[]
}
