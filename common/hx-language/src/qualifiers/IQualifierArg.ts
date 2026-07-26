import type { IMemberType } from "../members/IMemberType"
import type { QualifierRefKind } from "./QualifierRefKind"

/**
 * One resolved argument of a style qualifier - an ordinary member fact plus an
 * optional `refKind` set when the argument's TypeScript type is a branded ref
 * (`PropertyRef`/`EventRef`/`ThemeTokenRef`), which routes value completion to
 * the matching provider.
 */
export interface IQualifierArg extends IMemberType {
  refKind?: QualifierRefKind
}
