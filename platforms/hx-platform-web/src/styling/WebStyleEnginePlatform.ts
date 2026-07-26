import type { IKeyframeScope, StyleEffect, StyleEnginePlatform, StyleFragment, StyleHandle } from "@heleonix/hx-core"
import type { IStyleDeclarations } from "@heleonix/hx-language"
import { composeKeyframes } from "./composeKeyframes"
import { composeRule } from "./composeRule"
import { hashClassName } from "./hashClassName"
import { rewriteAnimationRefs } from "./rewriteAnimationRefs"
import { scopedKeyframeName } from "./scopedKeyframeName"
import { StyleWriteScheduler, synchronousScheduler } from "./StyleWriteScheduler"
import { WebStyleEffect } from "./WebStyleEffect"
import type { StyleSheetTarget } from "./StyleSheetTarget"
import type { WebStyleHandle } from "./WebStyleHandle"

/**
 * The web implementation of the core's {@link StyleEnginePlatform}: `compose`
 * turns a signature's neutral fragments + declarations into a content-hashed CSS
 * class written to the shared sheet (scoping animation references to the style's
 * local keyframes first), `composeKeyframe` emits one style-local `@keyframes`
 * under its scoped name, and `effectFor` yields a {@link WebStyleEffect} over the
 * component's root elements. The core refcounts every handle and calls `release`
 * when the last component drops it. `rootsOf` is injected so the platform stays
 * decoupled from the component implementation (and testable).
 */
export class WebStyleEnginePlatform<TComponent> implements StyleEnginePlatform<TComponent> {
  private readonly sheet: StyleSheetTarget

  private readonly rootsOf: (component: TComponent) => readonly HTMLElement[]

  private readonly scheduler: StyleWriteScheduler

  public constructor(
    sheet: StyleSheetTarget,
    rootsOf: (component: TComponent) => readonly HTMLElement[],
    scheduler: StyleWriteScheduler = synchronousScheduler,
  ) {
    this.sheet = sheet
    this.rootsOf = rootsOf
    this.scheduler = scheduler
  }

  public compose(
    signature: string,
    fragments: readonly StyleFragment[],
    declarations: Readonly<Record<string, string>>,
    keyframeScope?: IKeyframeScope,
  ): StyleHandle {
    const scoped = keyframeScope
      ? rewriteAnimationRefs(declarations, keyframeScope.names, keyframeScope.scope)
      : declarations
    const className = hashClassName(`${signature} ${JSON.stringify(scoped)}`)

    this.sheet.insert(className, composeRule(className, fragments, scoped))

    return { className } as WebStyleHandle as unknown as StyleHandle
  }

  public composeKeyframe(
    scope: string,
    name: string,
    frames: Readonly<Record<string, IStyleDeclarations>>,
  ): StyleHandle {
    const scopedName = scopedKeyframeName(scope, name)

    this.sheet.insert(scopedName, composeKeyframes(scopedName, frames))

    return { className: scopedName } as WebStyleHandle as unknown as StyleHandle
  }

  public release(handle: StyleHandle): void {
    this.sheet.remove((handle as unknown as WebStyleHandle).className)
  }

  public effectFor(component: TComponent): StyleEffect {
    return new WebStyleEffect(this.rootsOf(component), this.scheduler)
  }
}
