import { IsPlainObject } from "./IsPlainObject"

export type DeepMerge<TBase, TExtension> = {
  [K in keyof TBase | keyof TExtension]: K extends keyof TExtension
    ? K extends keyof TBase
      ? IsPlainObject<TBase[K]> extends true
        ? IsPlainObject<TExtension[K]> extends true
          ? DeepMerge<TBase[K], TExtension[K]>
          : TExtension[K]
        : TExtension[K]
      : TExtension[K]
    : K extends keyof TBase
      ? TBase[K]
      : never
}
