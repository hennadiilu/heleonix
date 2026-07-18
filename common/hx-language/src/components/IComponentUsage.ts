import type { IComponentProperty } from "./IComponentProperty"
import type { IComponentOverride } from "./IComponentOverride"

export interface IComponentUsage {
  tag: string

  name?: string

  properties?: IComponentProperty[]

  children?: IComponentUsage[]

  overrides?: IComponentOverride[]
}
