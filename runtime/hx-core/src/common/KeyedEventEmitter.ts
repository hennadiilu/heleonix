import { IKeyedEventEmitter } from "./IKeyedEventEmitter"

export class KeyedEventEmitter<
  TKey,
  TEventHandler extends (key: TKey, ...args: never[]) => void,
> implements IKeyedEventEmitter<TKey, TEventHandler> {
  public readonly handlers = new Map<TKey, Set<TEventHandler>>()

  public constructor(
    private readonly onInterceptor?: (key: TKey, handler: TEventHandler) => void,
    private readonly offInterceptor?: (key: TKey, handler: TEventHandler) => void,
  ) {}

  public emit(...args: Parameters<TEventHandler>): void {
    const handlers = this.handlers.get(args[0])

    if (!handlers) {
      return
    }

    for (const handler of handlers) {
      ;(handler as unknown as (...a: Parameters<TEventHandler>) => void)(...args)
    }
  }

  public on(key: TKey, handler: TEventHandler): void {
    this.onInterceptor?.(key, handler)

    let handlers = this.handlers.get(key)

    if (!handlers) {
      handlers = new Set()
      this.handlers.set(key, handlers)
    }

    handlers.add(handler)
  }

  public off(key: TKey, handler: TEventHandler): void {
    this.offInterceptor?.(key, handler)

    const handlers = this.handlers.get(key)

    if (!handlers) {
      return
    }

    handlers.delete(handler)

    if (handlers.size === 0) {
      this.handlers.delete(key)
    }
  }

  public clear(): void {
    this.handlers.clear()
  }
}
