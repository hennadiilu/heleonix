import { Converter } from "@heleonix/hx-core"

interface TruncateParams {
  /** Maximum number of characters to keep. */
  length: number
}

/** Shortens a string to a maximum length. */
export class TruncateConverter extends Converter<string, string, TruncateParams> {
  public static get diName(): string {
    return "TruncateConverter"
  }

  public format(value: string, params: TruncateParams): Promise<string> {
    const text = String(value ?? "")

    return Promise.resolve(text.length > params.length ? text.slice(0, params.length) : text)
  }

  public parse(value: string): Promise<string> {
    return Promise.resolve(value)
  }
}
