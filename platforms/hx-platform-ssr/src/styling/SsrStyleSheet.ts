/**
 * Accumulates composed CSS rules and `@keyframes` by key (their content-hashed
 * class / scoped name), the server-side analogue of the web's live `<style>`.
 * The core refcounts compose calls, so each key is inserted once and removed
 * when the last component drops it; {@link css} serializes the collected rules
 * in insertion order for one `<style>` block in the rendered document.
 */
export class SsrStyleSheet {
  private readonly rules = new Map<string, string>()

  public insert(key: string, rule: string): void {
    this.rules.set(key, rule)
  }

  public remove(key: string): void {
    this.rules.delete(key)
  }

  public css(): string {
    return [...this.rules.values()].join("\n")
  }
}
