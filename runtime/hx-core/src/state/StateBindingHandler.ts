import type { FQPropertyName } from "@heleonix/hx-language"

export type StateBindingHandler = (target: FQPropertyName, source: FQPropertyName) => void
