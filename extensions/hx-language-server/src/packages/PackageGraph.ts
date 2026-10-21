import fs from "node:fs"
import path from "node:path"
import type { IPackageNode } from "./IPackageNode"
import type { IPackageScope } from "./IPackageScope"

const PACKAGE_FILE = "package.json"
const NODE_MODULES = "node_modules"

// What a package ships with: a dependency's own development tooling is never
// part of what its dependents can reach, but a package's own dev dependencies
// are (an application often lists the libraries it bundles there).
const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"] as const
const OWN_DEPENDENCY_FIELDS = [...DEPENDENCY_FIELDS, "devDependencies"] as const

type PackageJson = { name?: unknown } & Partial<Record<(typeof OWN_DEPENDENCY_FIELDS)[number], unknown>>

/**
 * The workspace's packages and their dependencies. A file belongs to the deepest package holding it; a dependency
 * is a workspace package of that name or - with `linkedPackages` - a package linked in from outside the workspace
 * (a package manager's workspace link resolving outside any `node_modules`). Installed packages are not nodes.
 */
export class PackageGraph {
  private readonly nodes: readonly IPackageNode[]

  private readonly byName = new Map<string, IPackageNode>()

  private readonly externals = new Map<string, IPackageNode>()

  private readonly manifests = new Map<string, PackageJson | undefined>()

  private readonly scopes = new Map<string, IPackageScope>()

  private readonly workspace: IPackageScope

  /**
   * @param packageDirs The directories holding a `package.json` inside the roots.
   */
  public constructor(
    roots: readonly string[],
    packageDirs: Iterable<string>,
    private readonly linkedPackages: boolean,
  ) {
    const dirs = new Set([...packageDirs].map((dir) => path.resolve(dir)))

    // A root opened inside a package (a source folder) belongs to that package.
    for (const root of roots) {
      const owner = nearestPackageDir(root)

      if (owner) {
        dirs.add(owner)
      }
    }

    this.nodes = [...dirs]
      .sort((a, b) => b.length - a.length)
      .map((dir) => {
        const name = this.manifestOf(dir)?.name
        const node: IPackageNode = { dir, external: false, ...(typeof name === "string" ? { name } : {}) }

        if (node.name !== undefined && !this.byName.has(node.name)) {
          this.byName.set(node.name, node)
        }

        return node
      })

    for (const node of this.nodes) {
      this.closureOf(node)
    }

    const all = [...this.nodes, ...this.externals.values()]

    this.workspace = { key: "", packages: all, contains: () => true }
  }

  /** The packages linked in from outside the workspace that some workspace package depends on. */
  public externalPackages(): IPackageNode[] {
    return [...this.externals.values()]
  }

  /** The names of the packages whose sources the workspace holds or links in. */
  public packageNames(external: boolean): Set<string> {
    const nodes = external ? this.externals.values() : this.nodes

    return new Set([...nodes].flatMap((node) => (node.name === undefined ? [] : [node.name])))
  }

  public ownerOf(filePath: string): IPackageNode | undefined {
    const resolved = path.resolve(filePath)

    return this.nodes.find((node) => isWithin(node.dir, resolved))
  }

  /** The package holding a file: a workspace package, or one linked in from outside. */
  public packageOf(filePath: string): IPackageNode | undefined {
    const resolved = path.resolve(filePath)

    return this.ownerOf(resolved) ?? [...this.externals.values()].find((node) => isWithin(node.dir, resolved))
  }

  /** Whether a package is `name` or lists it as a dependency of any kind, itself or through its dependencies here. */
  public reaches(node: IPackageNode, name: string): boolean {
    return this.closureOf(node).packages.some(
      (member) =>
        member.name === name || dependencyNames(this.manifestOf(member.dir), OWN_DEPENDENCY_FIELDS).includes(name),
    )
  }

  /** The scope of a file - its package's - or the whole workspace for a file no package holds. */
  public scopeOf(filePath?: string): IPackageScope {
    const owner = filePath === undefined ? undefined : this.packageOf(filePath)

    return owner ? this.closureOf(owner) : this.workspace
  }

  private closureOf(owner: IPackageNode): IPackageScope {
    let scope = this.scopes.get(owner.dir)

    if (scope) {
      return scope
    }

    const packages: IPackageNode[] = [owner]

    for (let i = 0; i < packages.length; i++) {
      const fields = i === 0 ? OWN_DEPENDENCY_FIELDS : DEPENDENCY_FIELDS

      for (const name of dependencyNames(this.manifestOf(packages[i].dir), fields)) {
        const dependency = this.byName.get(name) ?? this.linkedOf(packages[i].dir, name)

        if (dependency && !packages.includes(dependency)) {
          packages.push(dependency)
        }
      }
    }

    const members = new Set(packages)

    scope = {
      key: owner.dir,
      packages,
      contains: (filePath) => {
        const node = this.packageOf(filePath)

        return node !== undefined && members.has(node)
      },
    }
    this.scopes.set(owner.dir, scope)

    return scope
  }

  private linkedOf(fromDir: string, name: string): IPackageNode | undefined {
    if (!this.linkedPackages) {
      return undefined
    }

    const target = linkedPackageDir(fromDir, name)

    if (!target) {
      return undefined
    }

    let node = this.nodes.find((candidate) => candidate.dir === target) ?? this.externals.get(target)

    if (!node) {
      const manifestName = this.manifestOf(target)?.name

      node = { dir: target, external: true, name: typeof manifestName === "string" ? manifestName : name }
      this.externals.set(target, node)
    }

    return node
  }

  private manifestOf(dir: string): PackageJson | undefined {
    if (!this.manifests.has(dir)) {
      let manifest: PackageJson | undefined

      try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, PACKAGE_FILE), "utf8")) as PackageJson
      } catch {
        manifest = undefined
      }

      this.manifests.set(dir, manifest)
    }

    return this.manifests.get(dir)
  }
}

function dependencyNames(manifest: PackageJson | undefined, fields: readonly (keyof PackageJson)[]): string[] {
  const names: string[] = []

  for (const field of fields) {
    const dependencies = manifest?.[field]

    if (dependencies && typeof dependencies === "object") {
      names.push(...Object.keys(dependencies))
    }
  }

  return names
}

function linkedPackageDir(fromDir: string, name: string): string | undefined {
  for (let current = fromDir; ; current = path.dirname(current)) {
    const candidate = path.join(current, NODE_MODULES, name)

    if (fs.existsSync(path.join(candidate, PACKAGE_FILE))) {
      const target = realPath(candidate)

      return target.split(/[\\/]/).includes(NODE_MODULES) ? undefined : target
    }

    if (path.dirname(current) === current) {
      return undefined
    }
  }
}

function nearestPackageDir(fromDir: string): string | undefined {
  for (let current = path.resolve(fromDir); ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, PACKAGE_FILE))) {
      return current
    }

    if (path.dirname(current) === current) {
      return undefined
    }
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child)

  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function realPath(target: string): string {
  try {
    return fs.realpathSync.native(target)
  } catch {
    return path.resolve(target)
  }
}
