import type { BindingType } from "@heleonix/hx-language"

/**
 * An interpolation occurrence found in text. `start`/`end` span the whole
 * `{ ... }`. For `dictionary` / `config` kinds, `name` and `entry` are the
 * qualified reference parts; `state` carries the bare name.
 */
export interface IInterpolationRef {
  kind: BindingType

  name?: string

  entry?: string

  start: number

  end: number
}
