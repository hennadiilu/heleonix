/**
 * The subset of VS Code's custom-data format (`@vscode/web-custom-data`,
 * `browsers.html-data.json`) the server consumes: W3C/MDN-sourced HTML
 * elements, their attributes, global attributes and enumerated value sets.
 */
export interface IWebCustomData {
  tags?: IWebCustomTag[]

  globalAttributes?: IWebCustomAttribute[]

  valueSets?: IWebCustomValueSet[]
}

export interface IWebCustomTag {
  name: string

  description?: IWebCustomDescription

  attributes?: IWebCustomAttribute[]

  references?: IWebCustomReference[]
}

export interface IWebCustomAttribute {
  name: string

  description?: IWebCustomDescription

  valueSet?: string

  values?: { name: string }[]

  references?: IWebCustomReference[]
}

export interface IWebCustomValueSet {
  name: string

  values: { name: string }[]
}

export interface IWebCustomReference {
  name: string

  url: string
}

export type IWebCustomDescription = string | { kind: string; value: string }
