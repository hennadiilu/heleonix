import type {
  Component,
  IKeyframeScope,
  IStyleDriver,
  IStyleEffect,
  StyleFragment,
  StyleHandle,
} from "@heleonix/hx-core"
import type { IStyleDeclarations } from "@heleonix/hx-language"
import {
  composeKeyframes,
  composeRule,
  hashClassName,
  rewriteAnimationRefs,
  scopedKeyframeName,
} from "@heleonix/hx-platform-web"
import { SsrElementState } from "./SsrElementState"
import { SsrStyleEffect } from "./SsrStyleEffect"
import { SsrStyleSheet } from "./SsrStyleSheet"
import type { SsrStyleHandle } from "./SsrStyleHandle"

export class SsrStyleDriver implements IStyleDriver {
  private readonly sheet = new SsrStyleSheet()

  private readonly states = new Map<Component, SsrElementState>()

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

    return { className } as SsrStyleHandle as unknown as StyleHandle
  }

  public composeKeyframe(
    scope: string,
    name: string,
    frames: Readonly<Record<string, IStyleDeclarations>>,
  ): StyleHandle {
    const scopedName = scopedKeyframeName(scope, name)

    this.sheet.insert(scopedName, composeKeyframes(scopedName, frames))

    return { className: scopedName } as SsrStyleHandle as unknown as StyleHandle
  }

  public release(handle: StyleHandle): void {
    this.sheet.remove((handle as unknown as SsrStyleHandle).className)
  }

  public effectFor(component: Component): IStyleEffect {
    return new SsrStyleEffect(this.stateFor(component))
  }

  public stateFor(component: Component): SsrElementState {
    let state = this.states.get(component)

    if (!state) {
      state = new SsrElementState()
      this.states.set(component, state)
    }

    return state
  }

  public css(): string {
    return this.sheet.css()
  }
}
