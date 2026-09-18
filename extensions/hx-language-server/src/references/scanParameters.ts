import { CONFIG_REF_PREFIX, DICTIONARY_REF_PREFIX, EXPRESSION_PATTERN } from "@heleonix/hx-language"
import type { IParameterRef } from "./IParameterRef"

export function scanParameters(text: string): IParameterRef[] {
  const params: IParameterRef[] = []
  const pattern = new RegExp(EXPRESSION_PATTERN, "g")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const name = match[1].trim()
    const lead = name.charAt(0)

    if (name && lead !== DICTIONARY_REF_PREFIX && lead !== CONFIG_REF_PREFIX) {
      params.push({ name, start: match.index, end: match.index + match[0].length })
    }
  }

  return params
}
