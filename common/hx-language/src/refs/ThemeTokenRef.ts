declare const themeTokenRefBrand: unique symbol

export type ThemeTokenRef = string & { readonly [themeTokenRefBrand]: "ThemeTokenRef" }
