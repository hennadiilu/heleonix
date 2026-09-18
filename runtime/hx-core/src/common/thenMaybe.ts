import type { MaybePromise } from "./MaybePromise"
import { isThenable } from "./isThenable"

export function thenMaybe<T, R>(value: MaybePromise<T>, fn: (resolved: T) => MaybePromise<R>): MaybePromise<R> {
  return isThenable(value) ? value.then(fn) : fn(value)
}
