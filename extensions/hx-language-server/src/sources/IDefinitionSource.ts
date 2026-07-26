import { IMetaDocument } from "@heleonix/hx-language"
import { IIndexContribution } from "../index/IIndexContribution"

/**
 * A pluggable provider of Heleonix definitions. The built-in
 * {@link WorkspaceDefinitionSource} scans `hx*` files in the workspace;
 * configured sources (workspace modules / JSON manifests, and HTTP endpoints
 * later) implement the same contract so the registry can compose them without
 * changes elsewhere.
 */
export interface IDefinitionSource {
  readonly id: string

  load(): Promise<IIndexContribution>

  /**
   * The type-level `hx.meta.json` manifests this source carries, available after
   * {@link load}. Fed to the analyzer so externally-sourced definitions validate
   * like workspace ones; sources with no meta (e.g. the workspace file source,
   * whose files the analyzer reads directly) omit it.
   */
  metas?(): readonly IMetaDocument[]
}
