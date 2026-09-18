import { CLOSE } from "./CLOSE"
import { OPEN } from "./OPEN"

export const EXPRESSION_PATTERN = `\\${OPEN}([^${CLOSE}]+)\\${CLOSE}`
