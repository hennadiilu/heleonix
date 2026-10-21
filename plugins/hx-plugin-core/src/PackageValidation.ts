import fs from "node:fs"
import { Analyzer } from "@heleonix/hx-analyzer"
import type { ITypeProgramHost } from "@heleonix/hx-analyzer"
import type { IMetaDocument } from "@heleonix/hx-language"
import { buildLevelOf } from "./buildLevelOf"
import type { IAssetFile } from "./IAssetFile"
import type { IBuildReport } from "./IBuildReport"
import type { IHxBuildSettings } from "./IHxBuildSettings"
import { locateFinding } from "./locateFinding"

/**
 * Validates a package the way editors do - its sources against each other, its TypeScript contracts and its
 * dependencies' manifests - across rebuilds, re-reading only the sources changed since.
 */
export class PackageValidation {
  private readonly analyzer = new Analyzer()

  private readonly mtimes = new Map<string, number>()

  public constructor(
    typeHosts: readonly ITypeProgramHost[],
    dependencyMetas: readonly IMetaDocument[],
    private readonly settings: Pick<IHxBuildSettings, "severity" | "failOnWarnings">,
  ) {
    this.analyzer.setTypeProgramHosts(typeHosts)

    for (const meta of dependencyMetas) {
      this.analyzer.addMeta(meta)
    }
  }

  /**
   * The findings over the package's current sources, at their build levels. A source's own compile errors are
   * left to whatever compiles it (a bundler's loader); the cross-file findings are reported here.
   */
  public async reports(sources: readonly IAssetFile[]): Promise<IBuildReport[]> {
    const current = new Set<string>()

    for (const asset of sources) {
      current.add(asset.absPath)
      this.read(asset)
    }

    for (const known of [...this.mtimes.keys()]) {
      if (!current.has(known)) {
        this.analyzer.removeFile(known)
        this.mtimes.delete(known)
      }
    }

    const reports: IBuildReport[] = []

    for (const finding of await this.analyzer.analyze()) {
      if (finding.code.startsWith("HX_COMPILER_") && current.has(finding.file)) {
        continue
      }

      const level = buildLevelOf(finding.code, finding.severity, this.settings)

      if (level) {
        reports.push({
          level,
          code: finding.code,
          text: `${finding.code}: ${finding.message} (${locateFinding(finding.file, finding.subject)})`,
        })
      }
    }

    return reports
  }

  private read(asset: IAssetFile): void {
    let mtimeMs: number

    try {
      mtimeMs = fs.statSync(asset.absPath).mtimeMs
    } catch {
      return
    }

    if (this.mtimes.get(asset.absPath) === mtimeMs) {
      return
    }

    this.mtimes.set(asset.absPath, mtimeMs)
    this.analyzer.setFile({
      path: asset.absPath,
      ext: asset.ext,
      name: asset.name,
      dimension: asset.dimension,
      source: fs.readFileSync(asset.absPath, "utf8"),
    })
  }
}
