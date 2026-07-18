import { USAGE_KEY, USAGE_VALUES } from "@heleonix/hx-language"

/**
 * Diagnostic message templates for `ConfigLanguageService`. Its entire
 * diagnostic surface is `diagnoseDataEnvelope`, so these are also reused by
 * `DictionaryLanguageService` (which wraps that same function).
 */
export const CONFIG_MESSAGES = {
  unknownUsage: (usage: string) => `Unknown ${USAGE_KEY} '${usage}' (expected ${USAGE_VALUES.join(" or ")}).`,
  parseError: "Parse error.",
} as const
