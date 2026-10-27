import type { Component, IStyleDriver, IStyleEffect, IStyleRule } from "@heleonix/hx-core"
import type { IStyleDeclarations } from "@heleonix/hx-language"
import { composeKeyframes, composeRule } from "@heleonix/hx-platform-web"
import { SsrElementState } from "./SsrElementState"
import { SsrStyleEffect } from "./SsrStyleEffect"
import { SsrStyleSheet } from "./SsrStyleSheet"

export class SsrStyleDriver implements IStyleDriver {
  private readonly sheet = new SsrStyleSheet()

  private readonly states = new Map<Component, SsrElementState>()

  public insertRule(rule: IStyleRule): void {
    this.sheet.insert(rule.id, composeRule(rule))
  }

  public insertKeyframes(id: string, frames: Readonly<Record<string, IStyleDeclarations>>): void {
    this.sheet.insert(id, composeKeyframes(id, frames))
  }

  public remove(id: string): void {
    this.sheet.remove(id)
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
