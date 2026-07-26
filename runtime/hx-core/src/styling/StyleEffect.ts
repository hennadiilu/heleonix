import type { StyleHandle } from "./StyleHandle"

/**
 * The styling-operation vocabulary a qualifier's `attach` drives per component
 * instance, the same lingua-franca stance as CSS declaration names: the core
 * declares the surface, each platform implements the subset it supports and
 * reports the rest as unsupported. Symmetric pairs only - no undefined
 * sentinels, no booleans. Keys are neutral (`setVariable("colorsPrimaryBg", …)`);
 * the platform owns any mangling (web: `--hx-colors-primary-bg`). Instance-scoped
 * and fanned out to every root; a DOM implementation batches per frame.
 */
export interface StyleEffect {
  setAttribute(name: string, value: string): void

  removeAttribute(name: string): void

  setVariable(name: string, value: string): void

  removeVariable(name: string): void

  setClass(handle: StyleHandle): void

  removeClass(handle: StyleHandle): void

  setProperty(name: string, value: string): void

  removeProperty(name: string): void
}
