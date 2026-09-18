type DataValue<V> = V extends (...args: never[]) => unknown
  ? never
  : V extends string | number | boolean | bigint | symbol | null | undefined
    ? V
    : V extends readonly (infer E)[]
      ? readonly DataValue<E>[]
      : V extends object
        ? { [K in keyof V]: DataValue<V[K]> }
        : V

export type DataParams<T> = {
  [K in keyof T]: DataValue<T[K]>
}
