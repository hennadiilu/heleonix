/**
 * Why a JSONC document is not a flat object of string values.
 *
 *   notObject  the root is not an object (array or primitive)
 *   nested     a value is a nested object or array
 *   nonString  a value is a number / boolean / null
 */
export type FlatObjectIssueKind = "notObject" | "nested" | "nonString"
