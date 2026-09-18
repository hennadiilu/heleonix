declare const propertyRefBrand: unique symbol

export type PropertyRef = string & { readonly [propertyRefBrand]: "PropertyRef" }
