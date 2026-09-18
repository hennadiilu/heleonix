export function isThenable(value: unknown): value is Promise<unknown> {
  return value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function"
}
