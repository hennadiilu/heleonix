import fs from "node:fs"
import path from "node:path"
import { TypeResolver } from "@heleonix/hx-analyzer"
import type { ITypeProgramHost } from "@heleonix/hx-analyzer"
import {
  EXT_TEMPLATE,
  EXT_THEME,
  collectControlNames,
  flattenThemeTokens,
  type IComponentDefinition,
  type IComponentHeader,
  type IComponentMetaEntry,
  type IConverterActionMetaEntry,
  type IDimension,
  type IDocsEntry,
  type IMetaDocument,
  type IQualifierDefinition,
  type IThemeDefinition,
} from "@heleonix/hx-language"
import { buildMeta } from "./buildMeta"
import { CompiledAssets } from "./CompiledAssets"
import type { IAssetFile } from "./IAssetFile"
import type { IMetaFailure } from "./IMetaFailure"

interface IHeaderedComponent {
  readonly name: string

  readonly dimension: IDimension

  readonly dir: string

  readonly header: IComponentHeader
}

/**
 * A package's `hx.meta.json`: the docs, component contracts, theme tokens and control names of its sources, and
 * the converters, actions, style qualifiers and programmatic components its own TypeScript declares - what a
 * consuming package validates against without reading the sources. Reused across rebuilds.
 */
export class PackageMetaBuilder {
  private readonly resolver?: TypeResolver

  public constructor(
    private readonly context: string,
    typeHosts: readonly ITypeProgramHost[],
    private readonly compiled: CompiledAssets = new CompiledAssets(),
  ) {
    this.resolver = typeHosts.length > 0 ? new TypeResolver(typeHosts) : undefined
  }

  public async build(sources: readonly IAssetFile[]): Promise<{ meta: IMetaDocument; failures: IMetaFailure[] }> {
    const docs: IDocsEntry[] = []
    const themeTokens: Record<string, string> = {}
    const controls = new Map<string, Set<string>>()
    const headered: IHeaderedComponent[] = []
    const failures: IMetaFailure[] = []

    for (const asset of sources) {
      try {
        const entry = this.compiled.docs(asset)

        if (entry) {
          docs.push(entry)
        }

        if (asset.ext === EXT_TEMPLATE) {
          const header = this.compiled.header(asset)

          if (header) {
            headered.push({ name: asset.name, dimension: asset.dimension, dir: path.dirname(asset.absPath), header })
          }

          const definition = (await this.compiled.definition(asset)) as IComponentDefinition
          const names = controls.get(asset.name) ?? new Set<string>()

          for (const control of collectControlNames(definition.children ?? [])) {
            names.add(control)
          }

          controls.set(asset.name, names)
        } else if (asset.ext === EXT_THEME) {
          const definition = (await this.compiled.definition(asset)) as IThemeDefinition

          Object.assign(themeTokens, flattenThemeTokens(definition.groups))
        }
      } catch (error) {
        failures.push({ file: asset.absPath, message: (error as Error).message })
      }
    }

    const classes = this.discoverClasses()
    const meta = buildMeta(
      {
        docs,
        components: [...this.componentEntries(headered, controls), ...classes.components],
        converters: classes.converters,
        actions: classes.actions,
        themeTokens,
        qualifiers: classes.qualifiers,
      },
      readPackageInfo(this.context),
    )

    return { meta, failures }
  }

  private discoverClasses(): {
    converters: IConverterActionMetaEntry[]
    actions: IConverterActionMetaEntry[]
    qualifiers: IQualifierDefinition[]
    components: IComponentMetaEntry[]
  } {
    const converters: IConverterActionMetaEntry[] = []
    const actions: IConverterActionMetaEntry[] = []
    const qualifiers: IQualifierDefinition[] = []
    const components: IComponentMetaEntry[] = []

    if (!this.resolver) {
      return { converters, actions, qualifiers, components }
    }

    for (const found of this.resolver.discover()) {
      if (found.hasHxName) {
        ;(found.base === "Converter" ? converters : actions).push({ name: found.name, params: found.params })
      }
    }

    for (const found of this.resolver.qualifiers()) {
      if (found.hasHxName) {
        qualifiers.push({ name: found.name, args: found.args })
      }
    }

    // Programmatic components (classes extending `Component<TProps, TEvents>`) ship
    // their resolved contract so consuming packages validate them too.
    for (const found of this.resolver.components()) {
      if (!found.hasHxName) {
        continue
      }

      const entry: IComponentMetaEntry = { name: found.name, dimension: {} }

      if (found.docs) {
        entry.docs = found.docs
      }

      if (found.props.length > 0) {
        entry.props = found.props
      }

      if (found.events.length > 0) {
        entry.events = found.events
      }

      components.push(entry)
    }

    return { converters, actions, qualifiers, components }
  }

  private componentEntries(
    headered: readonly IHeaderedComponent[],
    controls: ReadonlyMap<string, Set<string>>,
  ): IComponentMetaEntry[] {
    const requests: { id: string; dir: string; typeText: string }[] = []

    headered.forEach((component, index) => {
      for (const kind of ["props", "events"] as const) {
        const text = component.header[kind]

        if (text) {
          requests.push({ id: `${index}|${kind}`, dir: component.dir, typeText: text })
        }
      }
    })

    const resolved = this.resolver && requests.length > 0 ? this.resolver.resolve(requests) : undefined

    return headered.map((component, index) => {
      const entry: IComponentMetaEntry = { name: component.name, dimension: component.dimension }

      if (component.header.docs) {
        entry.docs = component.header.docs
      }

      for (const kind of ["props", "events"] as const) {
        const result = resolved?.get(`${index}|${kind}`)

        if (result?.resolved && result.members.length > 0) {
          entry[kind] = result.members
        }
      }

      const names = controls.get(component.name)

      if (names && names.size > 0) {
        entry.controls = [...names]
      }

      return entry
    })
  }
}

function readPackageInfo(context: string): { package?: string; version?: string } | undefined {
  let manifest: { name?: unknown; version?: unknown }

  try {
    manifest = JSON.parse(fs.readFileSync(path.join(context, "package.json"), "utf8")) as typeof manifest
  } catch {
    return undefined
  }

  return {
    ...(typeof manifest.name === "string" ? { package: manifest.name } : {}),
    ...(typeof manifest.version === "string" ? { version: manifest.version } : {}),
  }
}
