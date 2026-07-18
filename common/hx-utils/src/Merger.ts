import { DeepMerge } from "./DeepMerge"

export class Merger {
  private constructor() {}

  public static mergeDeeply<TBase, TExtension>(base: TBase, extension: TExtension): DeepMerge<TBase, TExtension> {
    // Nothing to overlay; hand `base` back untouched.
    if (extension === null || typeof extension !== "object" || Array.isArray(extension)) {
      return base as unknown as DeepMerge<TBase, TExtension>
    }

    const target = base as Record<string, unknown>
    const source = extension as Record<string, unknown>

    for (const key in source) {
      // Own enumerable keys only, and never let `__proto__` reach the assignment
      // below where it would re-target the prototype chain.
      if (!Object.hasOwn(source, key) || key === "__proto__") {
        continue
      }

      const sourceValue = source[key]
      const targetValue = target[key]

      if (Merger.isPlainObject(targetValue) && Merger.isPlainObject(sourceValue)) {
        // Both sides own a plain object: merge into the copy `base` already holds.
        Merger.mergeDeeply(targetValue, sourceValue)
      } else {
        // Otherwise the extension value wins; deep-copy it so `base` stays standalone.
        target[key] = Merger.cloneValue(sourceValue)
      }
    }

    return base as unknown as DeepMerge<TBase, TExtension>
  }

  private static cloneValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      const length = value.length
      const copy = new Array(length)

      for (let i = 0; i < length; i++) {
        copy[i] = Merger.cloneValue(value[i])
      }

      return copy
    }

    if (Merger.isPlainObject(value)) {
      const copy: Record<string, unknown> = {}

      for (const key in value) {
        if (!Object.hasOwn(value, key) || key === "__proto__") {
          continue
        }

        copy[key] = Merger.cloneValue(value[key])
      }

      return copy
    }

    return value
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") {
      return false
    }

    const proto: unknown = Object.getPrototypeOf(value)

    return proto === Object.prototype || proto === null
  }
}
