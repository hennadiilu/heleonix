export class SsrElementState {
  public readonly classes = new Set<string>()

  public readonly attributes = new Map<string, string>()

  public readonly styles = new Map<string, string>()
}
