import type { IComponentProperty } from "@heleonix/hx-language"

function hasBindingChanged(oldProp: IComponentProperty, newProp: IComponentProperty): boolean {
  return (
    oldProp.binding.type !== newProp.binding.type ||
    oldProp.binding.value !== newProp.binding.value ||
    (oldProp.binding.converters ?? []).join("|") !== (newProp.binding.converters ?? []).join("|")
  )
}

/**
 * Diffs a component's old and new property bindings by name and drives the
 * minimal set of calls: removed names are unbound, added names are bound, a name
 * whose binding expression changed is rebound, and a name that survives unchanged
 * is `refresh`ed. The reconcile only runs on a dimension switch, so `refresh` is
 * where a binding whose value is dimension-selected (dictionary/config) gets
 * re-resolved without the double work of rebinding the ones just added. Shared by
 * every component that keeps a set of property bindings, so the diff lives once
 * rather than being copied per component base.
 */
export async function reconcileBindings(
  oldProps: IComponentProperty[] | undefined,
  newProps: IComponentProperty[] | undefined,
  apply: (property: IComponentProperty) => Promise<void>,
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
