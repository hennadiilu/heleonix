import type { IStyleDeclarations } from "@heleonix/hx-language"
import type { Component } from "../components/Component"
import type { IKeyframeScope } from "./IKeyframeScope"
import type { IStyleEffect } from "./IStyleEffect"
import type { StyleFragment } from "../styling/StyleFragment"
import type { StyleHandle } from "./StyleHandle"

export interface IStyleDriver {
  compose(
    signature: string,
    fragments: readonly StyleFragment[],
    declarations: Readonly<Record<string, string>>,
    keyframeScope?: IKeyframeScope,
  ): StyleHandle

  composeKeyframe?(scope: string, name: string, frames: Readonly<Record<string, IStyleDeclarations>>): StyleHandle

  release(handle: StyleHandle): void

  effectFor(component: Component): IStyleEffect
}
