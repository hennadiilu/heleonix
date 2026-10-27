import type { Component, IScheduler, IStyleDriver, IStyleEffect, IStyleRule } from "@heleonix/hx-core"
import type { IStyleDeclarations } from "@heleonix/hx-language"
import { composeKeyframes } from "./composeKeyframes"
import { composeRule } from "./composeRule"
import { WebStyleEffect } from "./WebStyleEffect"
import type { StyleSheetTarget } from "./StyleSheetTarget"

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
    return new WebStyleEffect(this.rootsOf(component), this.scheduler)
  }
}
