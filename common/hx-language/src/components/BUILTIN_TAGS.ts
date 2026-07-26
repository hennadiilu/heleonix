/**
 * Tags provided by the framework itself (excluding the {@link ROOT_TAG}). They
 * are language constructs rather than user components from a definition source.
 */
export const BUILTIN_TAGS: ReadonlySet<string> = new Set([
  "Content",
  "OnUpdating",
  "OnAdding",
  "OnRaising",
  "OnDestroying",
  "Update",
  "Add",
  "Remove",
  "Move",
  "Raise",
  "Execute",
  "If",
  "Unless",
  "Switch",
  "Case",
  "Default",
  "List",
])
