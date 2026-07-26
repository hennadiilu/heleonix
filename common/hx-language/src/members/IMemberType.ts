/** Value-type classification of a component prop / converter param member. */
export type MemberKind = "string" | "number" | "boolean" | "enum" | "object" | "array" | "unknown"

/**
 * One resolved member of a `props`/`events`/`params` TypeScript type: the facts
 * the binding validator needs. `enumValues` is present for string-literal
 * unions and string enums; `isFunction` flags the no-functions guardrail;
 * `readonly` marks an input-only action parameter (any source may be bound),
 * as opposed to a mutable, in-out parameter that must bind a writable state path.
 */
export interface IMemberType {
  name: string

  optional: boolean

  kind: MemberKind

  enumValues?: string[]

  isFunction: boolean

  readonly?: boolean

  docs?: string
}
