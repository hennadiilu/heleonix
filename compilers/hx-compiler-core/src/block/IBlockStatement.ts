export interface IBlockStatement {
  kind: "statement"

  text: string

  /** Source offset of the text. */
  start: number

  doc?: string
}
