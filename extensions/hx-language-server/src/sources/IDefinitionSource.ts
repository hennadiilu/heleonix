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
}
