import type { IDimension, IDimensionDefinition } from "@heleonix/hx-language"

export interface IDimensionProvider {
  readonly definitions: readonly IDimensionDefinition[]

  readonly current: IDimension

  readonly currentKey: string
}
