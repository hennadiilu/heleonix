import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  createConnection,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  WatchKind,
} from "vscode-languageserver/node"
import { DiagnosticSeverity, FileSystemWatcher } from "vscode-languageserver"
import { EXT_CONFIG, EXT_DICTIONARY, EXT_STYLE, EXT_TEMPLATE, EXT_THEME } from "@heleonix/hx-language"
import { TextDocument } from "vscode-languageserver-textdocument"
import { transportFor } from "./transports/transportFor"
import { CompiledDefinitionSource } from "./sources/CompiledDefinitionSource"
import { DefinitionRegistry } from "./sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "./sources/WorkspaceDefinitionSource"
import { ILanguageContext } from "./languages/ILanguageContext"
import { LanguageRouter } from "./languages/LanguageRouter"
import { ILanguageServerSettings } from "./settings/ILanguageServerSettings"
import { parseReferenceSeverity } from "./settings/parseReferenceSeverity"
import { AnalyzerHost, ANALYZER_EXTS } from "./analysis/AnalyzerHost"
import { ComponentLanguageService } from "./languages/component/ComponentLanguageService"
import { StylingLanguageService } from "./languages/styling/StylingLanguageService"
import { ConfigLanguageService } from "./languages/config/ConfigLanguageService"
import { DictionaryLanguageService } from "./languages/dictionary/DictionaryLanguageService"

const DEFAULT_EXCLUDE = ["node_modules", "dist", "temp", "out"]
const DEBOUNCE_MS = 300
// Command id shared with the client (contributed in the extension's package.json).
const RELOAD_COMMAND = "heleonix.reloadDefinitions"
// Extensions maintained incrementally by the workspace source; any other watched
// change (a lockfile, a local manifest) triggers an external-source reload.
const HX_EXTS = new Set([EXT_TEMPLATE, EXT_DICTIONARY, EXT_CONFIG])
// Package-manager lockfiles: a change means dependencies (and thus the compiled
// definitions packages ship) may have changed.
const LOCKFILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"]

// Watchers (besides the hx* one) whose changes reload external definition
// sources: lockfiles plus any local file/dir/module sources. Computed on init.
let externalWatchers: FileSystemWatcher[] = []

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
const registry = new DefinitionRegistry()
const analyzerHost = new AnalyzerHost(() => settings.unknownReferenceSeverity)
let analyzerRoots: string[] = []
let analyzerExclude: ReadonlySet<string> = new Set(DEFAULT_EXCLUDE)
const router = new LanguageRouter([
  new ComponentLanguageService(),
  new DictionaryLanguageService(),
  new ConfigLanguageService(),
  new StylingLanguageService("style", EXT_STYLE),
  new StylingLanguageService("theme", EXT_THEME),
])

let settings: ILanguageServerSettings = {
  exclude: [],
  diagnosticsEnabled: true,
  unknownReferenceSeverity: DiagnosticSeverity.Warning,
  unusedEntrySeverity: DiagnosticSeverity.Information,
  definitionSources: [],
}

connection.onInitialize((params) => {
  const roots = collectRoots(params)
  const options = (params.initializationOptions ?? {}) as Partial<{
    exclude: string[]
    diagnostics: boolean
    unknownReferenceSeverity: string
    unusedEntrySeverity: string
    definitionSources: string[]
    workspaceTrusted: boolean
  }>

  settings = {
    exclude: options.exclude ?? [],
    diagnosticsEnabled: options.diagnostics !== false,
    unknownReferenceSeverity: parseReferenceSeverity(options.unknownReferenceSeverity ?? "warning"),
    unusedEntrySeverity: parseReferenceSeverity(options.unusedEntrySeverity ?? "information"),
    definitionSources: options.definitionSources ?? [],
  }

  const exclude = new Set([...DEFAULT_EXCLUDE, ...settings.exclude])

  analyzerRoots = roots
  analyzerExclude = exclude

  registry.register(new WorkspaceDefinitionSource(roots, exclude))

  const root = roots[0] ?? process.cwd()
  // Custom transport modules run workspace code; only honor them in a trusted
  // workspace. Missing flag (older client) is treated as untrusted.
  const trusted = options.workspaceTrusted === true

  for (const uri of settings.definitionSources) {
    const transport = transportFor(uri, root, trusted)

    if (!transport) {
      connection.console.warn(
        `[hx] skipped definition source '${uri}' (custom transport modules require a trusted workspace)`,
      )
      continue
    }

    registry.register(new CompiledDefinitionSource(transport))
  }

  externalWatchers = buildExternalWatchers(settings.definitionSources, root)

  const legend = router.semanticTokensLegend()

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: router.completionTriggerCharacters() },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      ...(legend ? { semanticTokensProvider: { legend, full: true } } : {}),
      executeCommandProvider: { commands: [RELOAD_COMMAND] },
      workspace: { workspaceFolders: { supported: true } },
    },
  }
})

// Manual "reload definitions" - re-pulls every external source (packages,
// endpoints, manifests). The main way to refresh `http(s)` sources, which can't
// be file-watched.
connection.onExecuteCommand(async (params) => {
  if (params.command === RELOAD_COMMAND) {
    await registry.reloadSources()

    for (const meta of registry.metas()) {
      analyzerHost.addMeta(meta)
    }

    refreshAllDiagnostics()
  }
})

connection.onInitialized(() => void initialize())

async function initialize(): Promise<void> {
  await registry.rebuild()
  analyzerHost.seed(analyzerRoots, analyzerExclude)

  // Feed the analyzer the type-level meta of every configured source (packages,
  // endpoints, custom transports), so their definitions validate like workspace
  // ones - not only the installed-dependency metas that `seed` auto-discovers.
  for (const meta of registry.metas()) {
    analyzerHost.addMeta(meta)
  }

  refreshAllDiagnostics()

  // Re-index when hx* files are created/changed/deleted on disk, and reload
  // external sources when lockfiles or local manifests change. (The client's own
  // watcher is intentionally not used, to avoid duplicate notifications.)
  await connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: router.watchGlob(), kind: WatchKind.Create | WatchKind.Change | WatchKind.Delete },
      ...externalWatchers,
    ],
  })
}

connection.onDidChangeWatchedFiles((params) => {
  for (const change of params.changes) {
    const filePath = uriToPath(change.uri)

    if (!filePath) {
      continue
    }

    // hx* files feed the incremental workspace index; anything else we watch (a
    // lockfile, a local manifest) means the external sources should be reloaded.
    if (!ANALYZER_EXTS.has(path.extname(filePath).toLowerCase())) {
      scheduleReload()
    } else if (change.type === FileChangeType.Deleted) {
      scheduleRemove(filePath)
    } else {
      scheduleUpdate(filePath, undefined)
    }
  }
})

documents.onDidOpen((event) => validate(event.document))

documents.onDidChangeContent((event) => {
  validate(event.document)

  const filePath = uriToPath(event.document.uri)

  if (filePath) {
    scheduleUpdate(filePath, event.document.getText())
  }
})

documents.onDidClose((event) => {
  router.forUri(event.document.uri)?.onClose?.(event.document.uri)
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] })

  const filePath = uriToPath(event.document.uri)

  if (filePath) {
    // In-memory edits are gone; resync the index to the on-disk content.
    scheduleUpdate(filePath, undefined)
  }
})

connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.completion ? service.completion(doc, params.position, context()) : []
})

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.hover ? service.hover(doc, params.position, context()) : null
})

connection.languages.semanticTokens.on((params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.semanticTokens ? service.semanticTokens(doc) : { data: [] }
})

connection.onDefinition((params) => {
  const doc = documents.get(params.textDocument.uri)
  const filePath = uriToPath(params.textDocument.uri)

  if (!doc || !filePath) {
    return null
  }

  // A service may resolve go-to-definition itself (a converter/action name to
  // its TypeScript class); otherwise fall back to the occurrence index.
  const service = router.forUri(doc.uri)
  const own = service?.definition?.(doc, params.position, context())

  if (own) {
    return own
  }

  return registry.getOccurrences().definitionsAt(filePath, doc.offsetAt(params.position))
})

connection.onReferences((params) => {
  const doc = documents.get(params.textDocument.uri)
  const filePath = uriToPath(params.textDocument.uri)

  if (!doc || !filePath) {
    return []
  }

  return registry
    .getOccurrences()
    .referencesAt(filePath, doc.offsetAt(params.position), params.context.includeDeclaration)
})

// --- Debounced incremental indexing -----------------------------------------

const pendingUpdate = new Map<string, string | undefined>()
const pendingRemove = new Set<string>()
let pendingReload = false
let flushTimer: NodeJS.Timeout | undefined

function scheduleUpdate(filePath: string, text: string | undefined): void {
  pendingRemove.delete(filePath)
  pendingUpdate.set(filePath, text)
  arm()
}

function scheduleRemove(filePath: string): void {
  pendingUpdate.delete(filePath)
  pendingRemove.add(filePath)
  arm()
}

function scheduleReload(): void {
  pendingReload = true
  arm()
}

function arm(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
  }

  flushTimer = setTimeout(() => void flush(), DEBOUNCE_MS)
}

async function flush(): Promise<void> {
  flushTimer = undefined

  for (const filePath of pendingRemove) {
    if (HX_EXTS.has(path.extname(filePath).toLowerCase())) {
      registry.removeFile(filePath)
    }

    analyzerHost.remove(filePath)
  }
  pendingRemove.clear()

  for (const [filePath, text] of pendingUpdate) {
    if (HX_EXTS.has(path.extname(filePath).toLowerCase())) {
      await registry.updateFile(filePath, text)
    }

    analyzerHost.update(filePath, text)
  }
  pendingUpdate.clear()

  if (pendingReload) {
    pendingReload = false
    await registry.reloadSources()
  }

  refreshAllDiagnostics()
}

// --- Diagnostics -------------------------------------------------------------

function validate(doc: TextDocument): void {
  if (!settings.diagnosticsEnabled) {
    return
  }

  void publishDiagnostics(doc)
}

async function publishDiagnostics(doc: TextDocument): Promise<void> {
  const service = router.forUri(doc.uri)
  const diagnostics = service ? service.diagnostics(doc, context()) : []
  const filePath = uriToPath(doc.uri)

  if (filePath && ANALYZER_EXTS.has(path.extname(filePath).toLowerCase())) {
    diagnostics.push(...(await analyzerHost.diagnosticsFor(filePath, doc)))
  }

  void connection.sendDiagnostics({ uri: doc.uri, diagnostics })
}

function refreshAllDiagnostics(): void {
  for (const doc of documents.all()) {
    validate(doc)
  }
}

function context(): ILanguageContext {
  return {
    index: registry.getIndex(),
    // The unresolved-reference family migrated to the shared analyzer (codes
    // HX_ANALYZER_0001-0003, severity from the same setting) - the legacy
    // in-service check stays off so findings are never doubled.
    unknownReferenceSeverity: undefined,
    unusedEntrySeverity: settings.unusedEntrySeverity,
    ...analyzerHost.snapshot(),
  }
}

// --- Helpers -----------------------------------------------------------------

function collectRoots(params: { workspaceFolders?: { uri: string }[] | null; rootUri?: string | null }): string[] {
  const uris = params.workspaceFolders?.map((folder) => folder.uri) ?? (params.rootUri ? [params.rootUri] : [])
  const roots: string[] = []

  for (const uri of uris) {
    const filePath = uriToPath(uri)

    if (filePath) {
      roots.push(filePath)
    }
  }

  return roots
}

function uriToPath(uri: string): string | undefined {
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}

function buildExternalWatchers(sources: readonly string[], root: string): FileSystemWatcher[] {
  const kind = WatchKind.Create | WatchKind.Change | WatchKind.Delete
  const watchers: FileSystemWatcher[] = LOCKFILES.map((name) => ({ globPattern: `**/${name}`, kind }))

  for (const uri of sources) {
    let absolute: string | undefined

    if (/^file:\/\//i.test(uri)) {
      absolute = fileURLToPath(uri)
    } else if (path.isAbsolute(uri) || uri.startsWith(".")) {
      absolute = path.resolve(root, uri)
    } else {
      continue // `http(s)://…` or a bare package specifier
    }

    // A file entry watches just that file; a directory entry watches its tree.
    const isFile = /\.(json|js|mjs|cjs)$/i.test(absolute)
    watchers.push({
      globPattern: {
        baseUri: pathToFileURL(isFile ? path.dirname(absolute) : absolute).href,
        pattern: isFile ? path.basename(absolute) : "**/*",
      },
      kind,
    })
  }

  return watchers
}

documents.listen(connection)
connection.listen()
