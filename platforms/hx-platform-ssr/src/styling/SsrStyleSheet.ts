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
