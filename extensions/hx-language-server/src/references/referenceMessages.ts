import { ReferenceType } from "@heleonix/hx-language"

export const REFERENCE_MESSAGES = {
  unknownName: (kind: ReferenceType, name: string) => `Unknown ${kind} '${name}'.`,
  unknownEntry: (kind: ReferenceType, name: string, entry: string) => `Unknown entry '${entry}' in ${kind} '${name}'.`,
  unusedEntry: (kind: ReferenceType, name: string, entry: string) =>
    `Entry '${entry}' in ${kind} '${name}' is not referenced anywhere.`,
} as const
