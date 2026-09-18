import type { IQualifierProvider } from "./IQualifierProvider"
import type { IStyleQualifier } from "./IStyleQualifier"

export class QualifierProvider implements IQualifierProvider {
  public constructor(
    private readonly qualifiers: ReadonlyMap<string, IStyleQualifier>,
    private readonly fallback?: IStyleQualifier,
  ) {}

  public get(name: string): IStyleQualifier | undefined {
    return this.qualifiers.get(name) ?? this.fallback
  }
}
