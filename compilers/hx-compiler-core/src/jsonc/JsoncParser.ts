import { parseJsonc } from "./parseJsonc"

export class JsoncParser {
  public parse(source: string): unknown {
    return parseJsonc(source).value
  }
}
