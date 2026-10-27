import type { IStyleDeclarations } from "@heleonix/hx-language"
import type { Component } from "../components/Component"
import type { IStyleEffect } from "./IStyleEffect"
import type { IStyleRule } from "./IStyleRule"

export interface IStyleDriver {
  insertRule(rule: IStyleRule): void

  insertKeyframes?(id: string, frames: Readonly<Record<string, IStyleDeclarations>>): void

  remove(id: string): void

  effectFor(component: Component): IStyleEffect
}
