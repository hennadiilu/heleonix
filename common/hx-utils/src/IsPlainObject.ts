export type IsPlainObject<T> = T extends object
  ? T extends readonly unknown[]
    ? false
    : T extends (...args: never[]) => unknown
      ? false
      : true
  : false
