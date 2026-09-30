import { HeleonixError } from "../errors/HeleonixError"
import { Errors } from "../errors/Errors"

export function hxNameMap<TConstructor extends { readonly hxName: string }>(
  ...registrations: readonly (readonly TConstructor[])[]
): Map<string, TConstructor> {
  const ctors = new Map<string, TConstructor>()

  for (const registration of registrations) {
    const names = new Set<string>()

    for (const ctor of registration) {
      if (names.has(ctor.hxName)) {
        throw new HeleonixError(Errors.duplicateHxName, ctor.hxName)
      }

      names.add(ctor.hxName)

      ctors.set(ctor.hxName, ctor)
    }
  }

  return ctors
}
