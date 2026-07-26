import type { IQualifierArg } from "./IQualifierArg"

/**
 * Contract of a style qualifier, discovered from its TypeScript surface and
 * shipped in `hx.meta.json` (mirroring converters/actions). Drives arg-name
 * completion, hover and value-routing in the LSP; the compiler never reads it -
 * rule-key signatures are mechanical.
 */
export interface IQualifierDefinition {
  /** Registry name used in rule keys, e.g. `If`, `Unless`, `Style`, `Media`. */
  name: string

  /** DI name of the qualifier class, when it differs from `name`. */
  diName?: string

  /** Resolved argument members, in declaration order. */
  args: IQualifierArg[]
}
