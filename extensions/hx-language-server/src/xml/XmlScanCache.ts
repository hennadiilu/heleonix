import { IXmlScan, scanXml } from "@heleonix/hx-compiler-core"
import { TextDocument } from "vscode-languageserver-textdocument"

export class XmlScanCache {
  private readonly entries = new Map<string, { version: number; scan: IXmlScan }>()

  public get(doc: TextDocument): IXmlScan {
    const cached = this.entries.get(doc.uri)

    if (cached && cached.version === doc.version) {
      return cached.scan
    }

    const scan = scanXml(doc.getText())
    this.entries.set(doc.uri, { version: doc.version, scan })

    return scan
  }

  public delete(uri: string): void {
    this.entries.delete(uri)
  }
}
