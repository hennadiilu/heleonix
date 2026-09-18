import type { IMemberType } from "./IMemberType"

export interface IResolvedType {
  resolved: boolean

  members: IMemberType[]
}
