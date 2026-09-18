export interface IKeyedEventEmitter<TKey, TEventHandler extends (key: TKey, ...args: never[]) => void> {
  on(key: TKey, handler: TEventHandler): void
  off(key: TKey, handler: TEventHandler): void
}
