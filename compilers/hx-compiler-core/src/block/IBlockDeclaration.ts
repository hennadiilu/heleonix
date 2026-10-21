export interface IBlockDeclaration {
  kind: "declaration"

  name: string

  value: string

  /** Source offset of the name. */
  start: number

  doc?: string
}
