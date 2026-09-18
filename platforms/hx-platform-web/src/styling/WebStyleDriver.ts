import type {
  Component,
  IKeyframeScope,
  IScheduler,
  IStyleDriver,
  IStyleEffect,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import type { IStyleDeclarations } from "@heleonix/hx-language"
import { composeKeyframes } from "./composeKeyframes"
import { composeRule } from "./composeRule"
import { hashClassName } from "./hashClassName"
import { rewriteAnimationRefs } from "./rewriteAnimationRefs"
import { scopedKeyframeName } from "./scopedKeyframeName"
import { WebStyleEffect } from "./WebStyleEffect"
import type { StyleSheetTarget } from "./StyleSheetTarget"
import type { WebStyleHandle } from "./WebStyleHandle"

export class WebStyleDriver implements IStyleDriver {
  private readonly sheet: StyleSheetTarget

  private readonly rootsOf: (component: Component) => readonly HTMLElement[]

  private readonly scheduler: IScheduler

  public constructor(
    sheet: StyleSheetTarget,
    rootsOf: (component: Component) => readonly HTMLElement[],
    scheduler: IScheduler,
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

  public effectFor(component: Component): IStyleEffect {
    return new WebStyleEffect(this.rootsOf(component), this.scheduler)
  }
}
