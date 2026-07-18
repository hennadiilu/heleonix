import { IEventEmitter } from "./IEventEmitter"

export class EventEmitter<TEventHandler extends (...args: never[]) => void> implements IEventEmitter<TEventHandler> {
  public readonly handlers = new Set<TEventHandler>()

  public emit(...args: Parameters<TEventHandler>): void {
    for (const handler of this.handlers) {
      handler(...args)
    }
  }

  public on(handler: TEventHandler): void {
    this.handlers.add(handler)
  }

  public off(handler: TEventHandler): void {
    this.handlers.delete(handler)
  }
}
