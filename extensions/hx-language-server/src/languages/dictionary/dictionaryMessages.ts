import { EXT_DICTIONARY } from "@heleonix/hx-language"

/** Diagnostic message templates for `DictionaryLanguageService`. */
export const DICTIONARY_MESSAGES = {
  notObject: `A dictionary (*${EXT_DICTIONARY}) must be a flat object of string values.`,
  nested: `Dictionary (*${EXT_DICTIONARY}) values must be strings; nested objects/arrays are not allowed.`,
  nonString: `Dictionary (*${EXT_DICTIONARY}) values must be strings.`,
  unknownParameter: (param: string) =>
    `Parameter '{${param}}' is not a property of any component that references this entry.`,
  unknownControl: (control: string) =>
    `Control '${control}' is not declared in any component that references this entry.`,
  unknownControlProperty: (control: string, property: string) =>
    `Property '${property}' is not available on control '${control}'.`,
} as const
