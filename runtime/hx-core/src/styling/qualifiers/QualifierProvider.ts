import type { StyleQualifier } from "./StyleQualifier"

export class QualifierProvider {
  public constructor(
    private readonly qualifiers: ReadonlyMap<string, StyleQualifier>,
    private readonly fallback?: StyleQualifier,
  ) {}

  public get(name: string): StyleQualifier | undefined {
    return this.qualifiers.get(name) ?? this.fallback
  }
}
