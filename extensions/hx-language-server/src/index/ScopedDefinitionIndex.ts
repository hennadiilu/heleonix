import { ReferenceType } from "@heleonix/hx-language"
import { DefinitionIndex } from "./DefinitionIndex"
import { IIndexContribution } from "./IIndexContribution"

/**
 * What a package's files can see - components, dictionaries and configs of the package and its dependencies -
 * while questions about usage (who references an entry, which properties a component receives) are answered
 * across the workspace: a package's users are its dependents, outside its own scope.
 */
export class ScopedDefinitionIndex extends DefinitionIndex {
  public constructor(
    visible: readonly IIndexContribution[],
    private readonly workspace: DefinitionIndex,
  ) {
    super(visible)
  }

  public override tagProperties(tag: string): readonly string[] {
    return this.workspace.tagProperties(tag)
  }

  public override entryReferrers(kind: ReferenceType, name: string, entry: string): readonly string[] {
    return this.workspace.entryReferrers(kind, name, entry)
  }

  public override isEntryUsed(kind: ReferenceType, name: string, entry: string): boolean {
    return this.workspace.isEntryUsed(kind, name, entry)
  }

  public override componentProperties(component: string): readonly string[] {
    return this.workspace.componentProperties(component)
  }

  public override referencedEntries(kind: ReferenceType, name: string): readonly string[] {
    return this.workspace.referencedEntries(kind, name)
  }

  public override incomingProperties(component: string): readonly string[] {
    return this.workspace.incomingProperties(component)
  }

  public override consumedProperties(component: string): readonly string[] {
    return this.workspace.consumedProperties(component)
  }
}
