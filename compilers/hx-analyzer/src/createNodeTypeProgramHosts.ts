import { findTypeProjects } from "./findTypeProjects"
import { NodeTypeProjects } from "./NodeTypeProjects"
import type { ITypeProgramHost } from "./ITypeProgramHost"
import type { ITypeProjectOptions } from "./ITypeProjectOptions"

/**
 * One program host per TypeScript project of the roots (see `ITypeProjectOptions`), outermost first, each typed by
 * its own compiler options.
 */
export function createNodeTypeProgramHosts(
  roots: readonly string[],
  options: ITypeProjectOptions = {},
): ITypeProgramHost[] {
  const projects = new NodeTypeProjects({ roots, exclude: options.exclude })
  const hosts: ITypeProgramHost[] = []

  for (const root of roots) {
    const found = options.projects ? findTypeProjects(root, options.projects, options.excludeDirs) : []
    const rootHosts = found.length > 0 ? found.flatMap((config) => projects.hostsOf(config)) : projects.fallbackOf(root)

    for (const host of rootHosts) {
      if (!hosts.includes(host)) {
        hosts.push(host)
      }
    }
  }

  return hosts
}
