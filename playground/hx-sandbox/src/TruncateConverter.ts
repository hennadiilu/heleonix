import { Converter } from "@heleonix/hx-core"

interface TruncateParams {
  /** Maximum number of characters to keep. */
  length: number
}

/** Shortens a string to a maximum length. */
export class TruncateConverter extends Converter<string, string, TruncateParams> {
  public async format(value: string, params: TruncateParams): Promise<string> {
    return value.length > params.length ? value.slice(0, params.length) : value
  }

  public async parse(value: string): Promise<string> {
    return value
  }
}
