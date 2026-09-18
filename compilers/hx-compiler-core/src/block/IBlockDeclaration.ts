export interface IBlockDeclaration {
  kind: "declaration"

  name: string

  value: string

  doc?: string
}
