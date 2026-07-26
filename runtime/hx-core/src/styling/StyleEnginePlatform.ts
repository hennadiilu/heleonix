import type { IStyleDeclarations } from "@heleonix/hx-language"
import type { IKeyframeScope } from "./IKeyframeScope"
import type { StyleEffect } from "./StyleEffect"
import type { StyleFragment } from "./StyleFragment"
import type { StyleHandle } from "./StyleHandle"

/**
 * The narrow callbacks a platform contributes behind the style engine, so the
 * core owns lifecycle/refcount/subscriptions and the platform owns CSS:
 * - `compose` turns a signature's neutral fragments + declarations into an
 *   opaque {@link StyleHandle} (a class on web) - called once per signature, the
 *   engine refcounts and `release`s it when the last component drops it;
 *   `keyframeScope`, when present, lets the platform scope animation references
 *   to the style's local keyframes.
 * - `composeKeyframe` (optional) emits one style-local `@keyframes` under a
 *   scoped name, refcounted and `release`d exactly like a composed rule.
 * - `effectFor` yields the per-instance {@link StyleEffect} the engine drives.
 */
export interface StyleEnginePlatform<TComponent> {
  compose(
    signature: string,
    fragments: readonly StyleFragment[],
    declarations: Readonly<Record<string, string>>,
    keyframeScope?: IKeyframeScope,
  ): StyleHandle

  composeKeyframe?(scope: string, name: string, frames: Readonly<Record<string, IStyleDeclarations>>): StyleHandle

  release(handle: StyleHandle): void

  effectFor(component: TComponent): StyleEffect
}
