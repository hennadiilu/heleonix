export interface IEventEmitter<TEventHandler extends (...args: never[]) => void> {
  on(handler: TEventHandler): void
  off(handler: TEventHandler): void
}
