declare const styleHandleBrand: unique symbol

export type StyleHandle = { readonly [styleHandleBrand]: never }
