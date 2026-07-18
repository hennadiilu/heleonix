import type { BindingType } from "./BindingType"

export type ReferenceType = Exclude<BindingType, "state">
