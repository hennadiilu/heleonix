import type { PropertyRef } from "@heleonix/hx-language"

export interface IIfQualifierArgs {
  /** The condition subject: a property of the styled component, `{prop}` or `{ctrl.path:prop}`. */
  value: PropertyRef

  /** Applies while the subject equals this operand; a boolean operand tests truthiness (`{false}` negates). */
  is?: string | number | boolean

  /** Applies while the subject differs from this operand; a boolean operand tests truthiness. */
  isNot?: string | number | boolean
}
