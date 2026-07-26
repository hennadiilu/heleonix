/**
 * The data-only projection of one value: functions map to `never` at every
 * depth, so a callback anywhere in the shape breaks assignability. Primitives
 * (including branded ones) are kept as-is - the primitive branch runs before
 * the object branch so a branded primitive is never treated as an object and
 * mangled. Arrays and plain objects are projected element- and member-wise,
 * preserving `readonly`/optional modifiers.
 *
 * Methodful objects (`Date`, `Map`, class instances) are consequently rejected:
 * their methods project to `never`. That is intended - converter/action params
 * must be data bindable from the DSL's JSON-like sources (state/config/dictionary
 * /literals), which cannot produce such values anyway.
 */
type DataValue<V> = V extends (...args: never[]) => unknown
  ? never
  : V extends string | number | boolean | bigint | symbol | null | undefined
    ? V
    : V extends readonly (infer E)[]
      ? readonly DataValue<E>[]
      : V extends object
        ? { [K in keyof V]: DataValue<V[K]> }
        : V

/**
 * Enforces the "no functions" contract on a converter/action parameter object
 * at compile time: any function-typed member - at any depth, inside nested
 * objects or arrays - maps to `never`, so a params type carrying a callback
 * fails the `TParams extends DataParams<TParams>` constraint at the class
 * declaration. Nested data objects and arrays are supported; optional and
 * readonly modifiers are preserved; it works for both `interface` and `type`
 * params (callbacks are events, not data).
 */
export type DataParams<T> = {
  [K in keyof T]: DataValue<T[K]>
}
