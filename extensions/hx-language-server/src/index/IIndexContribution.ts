import { IDocs, ReferenceType } from "@heleonix/hx-language"
import { IFileOccurrences } from "./occurrences/IFileOccurrences"

/**
 * Flat contribution a definition source adds to the workspace index.
 *
 * Keys are fully-qualified definition names (e.g. dictionary `Buttons`,
 * component `FromToList`); values are the entries / attribute names available
 * under them. Contributions from multiple sources are merged by the
 * {@link DefinitionRegistry}.
 */
export interface IIndexContribution {
  /** Component tag names that can be referenced via `<Name ...>`. */
  components: string[]

  /** Component tag name -> attribute/property names observed on its usages. */
  tagProperties: Record<string, string[]>

  /**
   * Component name -> tag names used directly inside its definition (real
   * component/HTML tags, excluding root/content/builtin and override tags).
   * Drives resolution of a `target:Component` override's tag segment and the
   * name/tag ambiguity check.
   */
  usedTags: Record<string, string[]>

  /** Reference kind (dictionary/config/...) -> name -> entry keys (for `@Name.entry`, `#Name.entry`, ...). */
  references: Record<ReferenceType, Record<string, string[]>>

  /**
   * Reverse of {@link references}: reference kind -> `compositeKey(name, entry)`
   * -> names of the components that reference that entry (via `@Name.entry` /
   * `#Name.entry`), plus any dictionary that references another dictionary entry.
   * Drives the dictionary parameter property pool and the unused-entry check.
   */
  entryReferrers: Record<ReferenceType, Record<string, string[]>>

  /** Component name -> head identifiers of the state/properties it reads internally. */
  componentState: Record<string, string[]>

  /**
   * `compositeKey(dictionaryName, entryKey)` -> state `{param}` names inside
   * that entry's value (possibly `ctrl:path` qualified). The index folds these
   * into the consumed-property pool of every component referencing the entry,
   * since such parameters resolve against the referrer's state at runtime.
   */
  entryParameters: Record<string, string[]>

  /** `compositeKey(componentName, controlName)` -> tag name(s) of the named control declared inside it. */
  namedControls: Record<string, string[]>

  /** Component name -> docs from the doc comment above its `<Component>` (summary, `@prop`s, ...). */
  componentDocs: Record<string, IDocs>

  /** Reference kind -> `compositeKey(name, entry)` -> docs of that dictionary/config entry. */
  entryDocs: Record<ReferenceType, Record<string, IDocs>>

  /**
   * Located symbol occurrences from a single scanned file, powering Go To
   * Definition / Find All References. Only file-backed sources
   * ({@link WorkspaceDefinitionSource}) set this; the location-less external
   * sources and the merged aggregate leave it undefined.
   */
  occurrences?: IFileOccurrences
}
