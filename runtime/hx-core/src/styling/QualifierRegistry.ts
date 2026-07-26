import type { IStyleQualifier } from "./IStyleQualifier"

/**
 * Maps a rule-key segment name (`Hover`, `Media`, `If`, `Style`) to the
 * qualifier that claims it. Bootstrap registration is manual (mirroring the
 * converter/action decision); one qualifier may claim many names (the pseudo
 * families claim hundreds). Plain and DI-free so the engine can be exercised
 * without the container.
 */
export class QualifierRegistry {
  private readonly byName = new Map<string, IStyleQualifier>()

  private fallback?: IStyleQualifier

  public register(name: string, qualifier: IStyleQualifier): void {
    this.byName.set(name, qualifier)
  }

  /**
   * The qualifier for any name not explicitly registered. Since the compiler
   * emits framework qualifiers (`If`/`Unless`/`Style`/`Media`) under known names
   * and every other segment is a pseudo, registering the pseudo qualifier as the
   * default covers the hundreds of CSS pseudos with no name dataset.
   */
  public setDefault(qualifier: IStyleQualifier): void {
    this.fallback = qualifier
  }

  public get(name: string): IStyleQualifier | undefined {
    return this.byName.get(name) ?? this.fallback
  }
}
