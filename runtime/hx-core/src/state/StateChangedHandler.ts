import type { FQPropertyName } from "@heleonix/hx-language"

export type StateChangedHandler = (fqPropertyName: FQPropertyName, newValue: unknown, oldValue: unknown) => void
