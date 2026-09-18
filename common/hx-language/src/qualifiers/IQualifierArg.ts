import type { IMemberType } from "../members/IMemberType"
import type { QualifierRefKind } from "./QualifierRefKind"

export interface IQualifierArg extends IMemberType {
  refKind?: QualifierRefKind
}
