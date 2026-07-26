import type { IMemberType } from "../members/IMemberType"

/**
 * Compile-time facts of one discovered converter/action class shipped in
 * `hx.meta.json`: its binding/registry name and resolved parameter members, so
 * a consuming package's analyzer can validate calls without re-scanning the
 * library's TypeScript sources.
 */
export interface IRegistryMetaEntry {
  name: string

  params: IMemberType[]
}
