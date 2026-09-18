export type MemberKind = "string" | "number" | "boolean" | "enum" | "object" | "array" | "unknown"

export interface IMemberType {
  name: string

  optional: boolean

  kind: MemberKind

  enumValues?: string[]

  isFunction: boolean

  readonly?: boolean

  docs?: string
}
