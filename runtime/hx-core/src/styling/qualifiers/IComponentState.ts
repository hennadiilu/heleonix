export interface IComponentState {
  subscribe(prop: string, handler: () => void): () => void

  getValue(prop: string): unknown
}
