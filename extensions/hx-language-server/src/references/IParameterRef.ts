/**
 * A state `{param}` occurrence found in a dictionary value. `name` is the
 * trimmed parameter (possibly `ctrl:path` qualified); `start`/`end` span the
 * whole `{ ... }`, relative to the scanned text.
 */
export interface IParameterRef {
  name: string

  start: number

  end: number
}
