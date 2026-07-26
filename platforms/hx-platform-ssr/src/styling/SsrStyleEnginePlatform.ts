import type { IKeyframeScope, StyleEffect, StyleEnginePlatform, StyleFragment, StyleHandle } from "@heleonix/hx-core"
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

/**
 * The SSR implementation of the core's {@link StyleEnginePlatform}. `compose` and
 * `composeKeyframe` run the web platform's own pure composers (`composeRule`,
 * `hashClassName`, `composeKeyframes`, animation scoping) into an in-memory
 * {@link SsrStyleSheet} instead of a live `<style>` - so the CSS and class names
 * are byte-identical to the client's, which is what makes hydration a no-op.
 * `effectFor` yields a {@link SsrStyleEffect} over a per-component
 * {@link SsrElementState}; `css` and {@link stateFor} expose what the renderer
 * serializes into the document.
 */
export class SsrStyleEnginePlatform<TComponent> implements StyleEnginePlatform<TComponent> {
  private readonly sheet = new SsrStyleSheet()

  private readonly states = new Map<TComponent, SsrElementState>()

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

  public effectFor(component: TComponent): StyleEffect {
    return new SsrStyleEffect(this.stateFor(component))
  }

  /** The accumulated markup state for a component's root element, for the renderer. */
  public stateFor(component: TComponent): SsrElementState {
    let state = this.states.get(component)

    if (!state) {
      state = new SsrElementState()
      this.states.set(component, state)
    }

    return state
  }

  /** The whole collected CSS, for one `<style>` block in the rendered document. */
  public css(): string {
    return this.sheet.css()
  }
}
