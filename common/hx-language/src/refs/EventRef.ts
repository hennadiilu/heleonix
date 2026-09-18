declare const eventRefBrand: unique symbol

export type EventRef = string & { readonly [eventRefBrand]: "EventRef" }
