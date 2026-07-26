import fs from "node:fs"
import path from "node:path"
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Analyzer, createNodeTypeProgramHost } from "@heleonix/hx-analyzer"
import { loadDependencyMetas } from "@heleonix/hx-plugin-core"
import type { IComponentInfo, IDiagnostic, IRegistryInfo, IThemeTokenLocation } from "@heleonix/hx-analyzer"
import type { IMetaDocument, IQualifierDefinition } from "@heleonix/hx-language"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"

/** Extensions the shared analyzer consumes - a superset of the language services'. */
export const ANALYZER_EXTS = new Set([EXT_TEMPLATE, EXT_DICTIONARY, EXT_CONFIG, EXT_STYLE, EXT_THEME])

// The unresolved-reference and legacy-ported inference families follow the
// user-configurable severity the legacy services applied (undefined disables
// them); everything else uses the analyzer severity policy. Syntax errors
// stay with the legacy services, which have precise parser ranges.
const REFERENCE_CODES = new Set([
  "HX_ANALYZER_0001",
  "HX_ANALYZER_0002",
  "HX_ANALYZER_0003",
  "HX_ANALYZER_0004",
  "HX_ANALYZER_0103",
  "HX_ANALYZER_0104",
])

/**
 * Hosts the shared `@heleonix/hx-analyzer` inside the language server: feeds
 * it the workspace snapshot incrementally and maps its position-less findings
 * onto ranges by locating each finding's `subject` in the document text - so
 * the editor and the build report identical codes from one implementation.
 */
export class AnalyzerHost {
  private readonly analyzer = new Analyzer()

  private readonly referenceSeverity: () => DiagnosticSeverity | undefined

  private version = 0

  private analyzedVersion = -1

  private findings: IDiagnostic[] = []

  public constructor(referenceSeverity: () => DiagnosticSeverity | undefined = () => DiagnosticSeverity.Warning) {
    this.referenceSeverity = referenceSeverity
  }

  public seed(roots: readonly string[], exclude: ReadonlySet<string>): void {
    const primaryRoot = roots[0]

    if (primaryRoot) {
      try {
        this.analyzer.setTypeProgramHost(createNodeTypeProgramHost(primaryRoot))
      } catch {
        // Without a resolvable TypeScript project the analyzer stays in
        // reference-only mode rather than failing to start.
      }
    }

    for (const root of roots) {
      this.walk(root, exclude)
    }

    for (const root of roots) {
      try {
        for (const meta of loadDependencyMetas(root)) {
          this.addMeta(meta)
        }
      } catch {
        // Dependency metadata only adds precision - never fail seeding on it.
      }
    }
  }

  public addMeta(meta: IMetaDocument): void {
    this.analyzer.addMeta(meta)
    this.version += 1
  }

  /** Converters known to the editor, from the most recent analysis. */
  public converters(): IRegistryInfo[] {
    return this.analyzer.converters()
  }

  /** Actions known to the editor, from the most recent analysis. */
  public actions(): IRegistryInfo[] {
    return this.analyzer.actions()
  }

  /** Components known to the editor (workspace + native), from the most recent analysis. */
  public components(): IComponentInfo[] {
    return this.analyzer.components()
  }

  /** The merged theme token space (workspace `*.hxt` + dependency meta): path -> value. */
  public themeTokens(): Map<string, string> {
    return this.analyzer.themeTokens()
  }

  /** Control names per component (workspace + meta), for `@hx-style(for: ...)` scope completion. */
  public controlNames(): Map<string, string[]> {
    return this.analyzer.controlNames()
  }

  /** Where each workspace theme token is defined, for `{$...}` go-to-definition. */
  public themeTokenLocations(): Map<string, IThemeTokenLocation> {
    return this.analyzer.themeTokenLocations()
  }

  /** Style qualifiers known to the editor (discovered classes + meta-delivered contracts). */
  public qualifiers(): IQualifierDefinition[] {
    return this.analyzer.qualifiers()
  }

  public update(filePath: string, text: string | undefined): void {
    let source = text

    if (source === undefined) {
      try {
        source = fs.readFileSync(filePath, "utf8")
      } catch {
        this.remove(filePath)

        return
      }
    }

    this.setFile(filePath, source)
  }

  public remove(filePath: string): void {
    this.analyzer.removeFile(filePath)
    this.version += 1
  }

  public async diagnosticsFor(filePath: string, document: TextDocument): Promise<Diagnostic[]> {
    if (this.analyzedVersion !== this.version) {
      this.analyzedVersion = this.version
      this.findings = await this.analyzer.analyze()
    }

    const result: Diagnostic[] = []
    const text = document.getText()

    for (const finding of this.findings) {
      if (finding.file !== filePath) {
        continue
      }

      if (finding.code.startsWith("HX_COMPILER_")) {
        continue
      }

      let severity: DiagnosticSeverity | undefined =
        finding.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning

      if (REFERENCE_CODES.has(finding.code)) {
        severity = this.referenceSeverity()

        if (severity === undefined) {
          continue
        }
      }

      for (const range of rangesOf(text, finding, document)) {
        result.push({
          range,
          severity,
          code: finding.code,
          source: "heleonix",
          message: finding.message,
        })
      }
    }

    return result
  }

  private walk(dir: string, exclude: ReadonlySet<string>): void {
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || exclude.has(entry.name)) {
        continue
      }

      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        this.walk(full, exclude)
      } else if (ANALYZER_EXTS.has(path.extname(entry.name).toLowerCase())) {
        this.update(full, undefined)
      }
    }
  }

  private setFile(filePath: string, source: string): void {
    const base = path.basename(filePath)

    this.analyzer.setFile({
      path: filePath,
      ext: path.extname(filePath).toLowerCase(),
      // The language server does not know the application's dimension
      // configuration, so names are the first filename segment and dimensions
      // stay empty - the analyzer unions facts by name anyway.
      name: base.split(".")[0],
      dimension: {},
      source,
    })
    this.version += 1
  }
}

/** All occurrences of the finding's subject; the document start when unknown. */
function rangesOf(
  text: string,
  finding: IDiagnostic,
  document: TextDocument,
): { start: { line: number; character: number }; end: { line: number; character: number } }[] {
  const subject = finding.subject

  if (!subject) {
    return [{ start: document.positionAt(0), end: document.positionAt(0) }]
  }

  const result = []

  for (let from = text.indexOf(subject); from !== -1; from = text.indexOf(subject, from + subject.length)) {
    result.push({ start: document.positionAt(from), end: document.positionAt(from + subject.length) })
  }

  return result.length > 0 ? result : [{ start: document.positionAt(0), end: document.positionAt(0) }]
}
