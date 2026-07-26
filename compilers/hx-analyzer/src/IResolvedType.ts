import type { IMemberType } from "./IMemberType"

/**
 * The result of resolving a header's `props`/`events`/`params` type text
 * through the TypeScript compiler. `resolved` is false when the type text
 * references a name the program cannot find (the analyzer reports it).
 */
export interface IResolvedType {
  resolved: boolean

  members: IMemberType[]
}
