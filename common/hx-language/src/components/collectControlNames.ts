import type { IComponentUsage } from "./IComponentUsage"

export function collectControlNames(usages: readonly IComponentUsage[]): string[] {
  const names = new Set<string>()

  collect(usages, names)

  return [...names]
}

function collect(usages: readonly IComponentUsage[], names: Set<string>): void {
  for (const usage of usages) {
    if (usage.name) {
      names.add(usage.name)
    }

    if (usage.children) {
      collect(usage.children, names)
    }

    for (const override of usage.overrides ?? []) {
      if (override.children) {
        collect(override.children, names)
      }
    }
  }
}
