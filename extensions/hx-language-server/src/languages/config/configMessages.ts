import { USAGE_KEY, USAGE_VALUES } from "@heleonix/hx-language"

export const CONFIG_MESSAGES = {
  unknownUsage: (usage: string) => `Unknown ${USAGE_KEY} '${usage}' (expected ${USAGE_VALUES.join(" or ")}).`,
  parseError: "Parse error.",
} as const
