import type { IComponentProperty } from "@heleonix/hx-language"
import type { MaybePromise } from "../common/MaybePromise"

function hasBindingChanged(oldProp: IComponentProperty, newProp: IComponentProperty): boolean {
  return (
    oldProp.binding.type !== newProp.binding.type ||
    oldProp.binding.value !== newProp.binding.value ||
    (oldProp.binding.converters ?? []).join("|") !== (newProp.binding.converters ?? []).join("|")
  )
}

export async function reconcileBindings(
  oldProps: IComponentProperty[] | undefined,
  newProps: IComponentProperty[] | undefined,
  apply: (property: IComponentProperty) => MaybePromise<void>,
  remove: (property: IComponentProperty) => void,
  refresh: (property: IComponentProperty) => void,
): Promise<void> {
  const oldMap = new Map<string, IComponentProperty>()

  for (const property of oldProps ?? []) {
    oldMap.set(property.name, property)
  }

  const newMap = new Map<string, IComponentProperty>()

  for (const property of newProps ?? []) {
    newMap.set(property.name, property)
  }

  for (const [name, oldProp] of oldMap) {
    if (!newMap.has(name)) {
      remove(oldProp)
    }
  }

  for (const [name, newProp] of newMap) {
    const oldProp = oldMap.get(name)

    if (!oldProp) {
      await apply(newProp)
    } else if (hasBindingChanged(oldProp, newProp)) {
      remove(oldProp)
      await apply(newProp)
    } else {
      refresh(newProp)
    }
  }
}
