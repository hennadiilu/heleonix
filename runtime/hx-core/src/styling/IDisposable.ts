/**
 * Something with a cleanup step. A style qualifier's `attach` returns one so the
 * style engine can undo the per-instance work (subscriptions, effects) when a
 * component is destroyed or a style is removed.
 */
export interface IDisposable {
  dispose(): void
}
