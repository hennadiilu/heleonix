import type { IQualifierUsage } from "@heleonix/hx-language"
import type { ComponentStateAccessor } from "./ComponentStateAccessor"
import type { StyleEffect } from "./StyleEffect"
import type { StyleFragment } from "./StyleFragment"
import type { IDisposable } from "./IDisposable"

/**
 * The structural contract every style qualifier satisfies. Both methods are
 * optional and a qualifier provides one or both:
 * - `build` is pure and runs once per signature, mapping a parsed rule-key
 *   segment to a neutral {@link StyleFragment} (pseudos, media, gates).
 * - `attach` runs per component instance: it subscribes to state via the
 *   {@link ComponentStateAccessor} and drives {@link StyleEffect}s, returning an
 *   {@link IDisposable} to undo that work (e.g. `@hx-if` toggling a `data-*` gate).
 */
export interface IStyleQualifier {
  build?(usage: IQualifierUsage): StyleFragment | undefined

  attach?(usage: IQualifierUsage, state: ComponentStateAccessor, effect: StyleEffect): IDisposable
}
