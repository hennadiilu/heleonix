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
import { DiagnosticSeverity, Disposable, FileSystemWatcher } from "vscode-languageserver"
import { EXT_STYLE, EXT_THEME } from "@heleonix/hx-language"
import { HX_CONFIG_FILE, NODE_CONFIG_HOST } from "@heleonix/hx-plugin-core"
import type { IHxConfigHost } from "@heleonix/hx-plugin-core"
import { TextDocument } from "vscode-languageserver-textdocument"
import { transportFor } from "./transports/transportFor"
import { CompiledDefinitionSource } from "./sources/CompiledDefinitionSource"
import { DefinitionRegistry } from "./sources/DefinitionRegistry"
import { WorkspaceDefinitionSource } from "./sources/WorkspaceDefinitionSource"
import { ILanguageContext } from "./languages/ILanguageContext"
import { LanguageRouter } from "./languages/LanguageRouter"
import { ILanguageServerSettings } from "./settings/ILanguageServerSettings"
import type { ILanguageServerOptions } from "./settings/ILanguageServerOptions"
import { settingsOf } from "./settings/settingsOf"
import { WorkspaceConfigs } from "./settings/WorkspaceConfigs"
import { toDiagnosticSeverity } from "./lsp/toDiagnosticSeverity"
import { UNUSED_ENTRY_CODE } from "./lsp/UNUSED_ENTRY_CODE"
import { AnalyzerHost, ANALYZER_EXTS } from "./analysis/AnalyzerHost"
import { ComponentLanguageService } from "./languages/component/ComponentLanguageService"
import { StylingLanguageService } from "./languages/styling/StylingLanguageService"
import { ConfigLanguageService } from "./languages/config/ConfigLanguageService"
import { DictionaryLanguageService } from "./languages/dictionary/DictionaryLanguageService"

const DEFAULT_EXCLUDE = ["node_modules", "dist", "temp", "out"]
const DEBOUNCE_MS = 300
// Command id shared with the client (contributed in the extension's package.json).
const RELOAD_COMMAND = "heleonix.reloadDefinitions"
// Package-manager lockfiles: a change means dependencies (and thus the compiled
// definitions packages ship) may have changed.
const LOCKFILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"]
// TypeScript sources the analysis discovers classes in (converters, actions,
// style qualifiers, components), and the files that define which projects exist.
const TYPE_SOURCE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"])
const TYPE_SOURCE_PATTERN = "**/*.{ts,tsx,mts,cts}"
const TYPE_PROJECT_PATTERN = "**/{tsconfig*.json,package.json,pnpm-workspace.yaml,lerna.json}"
const WATCH_ALL = WatchKind.Create | WatchKind.Change | WatchKind.Delete

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
const router = new LanguageRouter([
  new ComponentLanguageService(),
  new DictionaryLanguageService(),
  new ConfigLanguageService(),
  new StylingLanguageService("style", EXT_STYLE),
  new StylingLanguageService("theme", EXT_THEME),
])

// Configuration files are read through the editor's unsaved documents first, so
// an edit to `hx.config.json` applies as it is typed.
const configHost: IHxConfigHost = {
  readFile: (file) => openDocumentOf(file)?.getText() ?? NODE_CONFIG_HOST.readFile(file),
  resolvePackage: (specifier, fromFile) => NODE_CONFIG_HOST.resolvePackage(specifier, fromFile),
}

let roots: string[] = []
let settings: ILanguageServerSettings = settingsOf({})
let trusted = false
let exclude: ReadonlySet<string> = new Set(DEFAULT_EXCLUDE)
let registry = new DefinitionRegistry()
let configs = new WorkspaceConfigs(settings, configHost)
let analyzerHost = new AnalyzerHost(configs)

// The registrations watching the workspace's files, replaced whenever what they
// watch changes: the sources and external definitions, every TypeScript project
// the analysis reads, and every file the configurations read or may appear at.
let fileWatchers: Disposable | undefined
let typeWatchers: Disposable | undefined
let configWatchers: Disposable | undefined

// The files currently carrying a configuration's load error.
let configErrorUris = new Set<string>()

connection.onInitialize((params) => {
  roots = collectRoots(params)
  configure((params.initializationOptions ?? {}) as ILanguageServerOptions)

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

connection.onInitialized(() => void initialize())

// A host pushing new settings (rather than restarting the server, as the VS Code
// client does): everything is rebuilt from them.
connection.onDidChangeConfiguration((change) => {
  const options = (change.settings as { heleonix?: { hx?: ILanguageServerOptions } } | undefined)?.heleonix?.hx

  if (options) {
    configure({ workspaceTrusted: trusted, ...options })
    void initialize()
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

// Applies a host's options: the editor-level settings, the workspace configurations
// falling back to them, and the definition sources they name.
function configure(options: ILanguageServerOptions): void {
  settings = settingsOf(options)
  // Custom transport modules run workspace code; only honor them in a trusted
  // workspace. A missing flag counts as untrusted.
  trusted = options.workspaceTrusted === true
  exclude = new Set([...DEFAULT_EXCLUDE, ...settings.exclude])
  configs = new WorkspaceConfigs(settings, configHost)
  analyzerHost = new AnalyzerHost(configs)
  registry = new DefinitionRegistry()
  registry.register(new WorkspaceDefinitionSource(roots, exclude, (file) => configs.compiles(file)))

  const root = roots[0] ?? process.cwd()

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
}

async function initialize(): Promise<void> {
  await registry.rebuild()
  analyzerHost.seed(roots, exclude)

  // Feed the analyzer the type-level meta of every configured source (packages,
  // endpoints, custom transports), so their definitions validate like workspace
  // ones - not only the installed-dependency metas that `seed` auto-discovers.
  for (const meta of registry.metas()) {
    analyzerHost.addMeta(meta)
  }

  publishConfigErrors()
  refreshAllDiagnostics()

  // Re-index when hx* files are created/changed/deleted on disk, and reload
  // external sources when lockfiles or local manifests change. (The client's own
  // watcher is intentionally not used, to avoid duplicate notifications.)
  fileWatchers?.dispose()
  fileWatchers = await connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: router.watchGlob(), kind: WATCH_ALL },
      ...buildExternalWatchers(settings.definitionSources, roots[0] ?? process.cwd()),
    ],
  })
  await watchTypeProjects()
  await watchConfigs()
}

// Linked workspace packages usually sit outside the open folders, so each
// project directory is watched through its own base URI.
async function watchTypeProjects(): Promise<void> {
  typeWatchers?.dispose()
  typeWatchers = await connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: analyzerHost.typeProjectDirs().flatMap((dir) => {
      const baseUri = pathToFileURL(dir).href

      return [
        { globPattern: { baseUri, pattern: TYPE_SOURCE_PATTERN }, kind: WATCH_ALL },
        { globPattern: { baseUri, pattern: TYPE_PROJECT_PATTERN }, kind: WATCH_ALL },
      ]
    }),
  })
}

// Any new `hx.config.json` in the workspace, and each file the configurations
// read or were looked for at - wherever it is, a dimensions file of any name or
// a configuration above the open folders.
async function watchConfigs(): Promise<void> {
  const { files, missing } = configs.inputs()

  configWatchers?.dispose()
  configWatchers = await connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: `**/${HX_CONFIG_FILE}`, kind: WATCH_ALL },
      ...[...new Set([...files, ...missing])].map((file) => ({
        globPattern: { baseUri: pathToFileURL(path.dirname(file)).href, pattern: path.basename(file) },
        kind: WATCH_ALL,
      })),
    ],
  })
}

connection.onDidChangeWatchedFiles((params) => {
  for (const change of params.changes) {
    const filePath = uriToPath(change.uri)

    if (!filePath) {
      continue
    }

    const ext = path.extname(filePath).toLowerCase()
    const name = path.basename(filePath)

    // A configuration's file reshapes everything it governs; hx* files feed the
    // incremental workspace index and TypeScript sources the class discovery; a
    // `tsconfig` or `package.json` reshapes the projects; anything else we watch
    // (a lockfile, a local manifest) means the external sources should be
    // reloaded - and a lockfile, that links may have changed.
    if (isConfigFile(filePath)) {
      scheduleConfigs()
    } else if (ANALYZER_EXTS.has(ext)) {
      if (change.type === FileChangeType.Deleted) {
        scheduleRemove(filePath)
      } else {
        scheduleUpdate(filePath, undefined)
      }
    } else if (TYPE_SOURCE_EXTS.has(ext)) {
      scheduleTypes()
    } else if (isTypeProjectFile(name)) {
      scheduleProjects()
    } else {
      scheduleReload()

      if (LOCKFILES.includes(name)) {
        scheduleProjects()
      }
    }
  }
})

// A configuration document the host sends (`hx.config.json`) is read live - it
// is no source of its own, so it gets no language features.
documents.onDidOpen((event) => {
  if (isConfigDocument(event.document)) {
    scheduleConfigs()
  } else {
    validate(event.document)
  }
})

documents.onDidChangeContent((event) => {
  if (isConfigDocument(event.document)) {
    scheduleConfigs()

    return
  }

  validate(event.document)

  const filePath = uriToPath(event.document.uri)

  if (filePath) {
    scheduleUpdate(filePath, event.document.getText())
  }
})

documents.onDidClose((event) => {
  if (isConfigDocument(event.document)) {
    // Its unsaved edits are gone; the file on disk governs again.
    scheduleConfigs()

    return
  }

  router.forUri(event.document.uri)?.onClose?.(event.document.uri)
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] })

  const filePath = uriToPath(event.document.uri)

  if (filePath) {
    // In-memory edits are gone; resync the index to the on-disk content.
    scheduleUpdate(filePath, undefined)
  }

  // A package scope lives while one of its files is open.
  analyzerHost.retain(
    documents
      .all()
      .filter((doc) => doc.uri !== event.document.uri)
      .flatMap((doc) => uriToPath(doc.uri) ?? []),
  )
})

connection.onCompletion(async (params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.completion ? service.completion(doc, params.position, await context(doc)) : []
})

connection.onHover(async (params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.hover ? service.hover(doc, params.position, await context(doc)) : null
})

connection.languages.semanticTokens.on((params) => {
  const doc = documents.get(params.textDocument.uri)
  const service = doc && router.forUri(doc.uri)

  return doc && service?.semanticTokens ? service.semanticTokens(doc) : { data: [] }
})

connection.onDefinition(async (params) => {
  const doc = documents.get(params.textDocument.uri)
  const filePath = uriToPath(params.textDocument.uri)

  if (!doc || !filePath) {
    return null
  }

  // A service may resolve go-to-definition itself (a converter/action name to
  // its TypeScript class); otherwise fall back to the occurrence index.
  const service = router.forUri(doc.uri)
  const own = service?.definition?.(doc, params.position, await context(doc))

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
let pendingTypes = false
let pendingProjects = false
let pendingConfigs = false
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

function scheduleTypes(): void {
  pendingTypes = true
  arm()
}

function scheduleProjects(): void {
  pendingProjects = true
  arm()
}

function scheduleConfigs(): void {
  pendingConfigs = true
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
    registry.removeFile(filePath)
    analyzerHost.remove(filePath)
  }
  pendingRemove.clear()

  for (const [filePath, text] of pendingUpdate) {
    await registry.updateFile(filePath, text)
    analyzerHost.update(filePath, text)
  }
  pendingUpdate.clear()

  if (pendingReload) {
    pendingReload = false
    await registry.reloadSources()
  }

  if (pendingConfigs) {
    pendingConfigs = false
    pendingProjects = false
    pendingTypes = false
    await reloadConfigs()
  } else if (pendingProjects) {
    pendingProjects = false
    pendingTypes = false
    analyzerHost.reloadProjects()
    await watchTypeProjects()
  } else if (pendingTypes) {
    pendingTypes = false
    analyzerHost.typesChanged()
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
  const diagnostics = service ? service.diagnostics(doc, await context(doc)) : []
  const filePath = uriToPath(doc.uri)

  if (filePath && ANALYZER_EXTS.has(path.extname(filePath).toLowerCase())) {
    diagnostics.push(...(await analyzerHost.diagnosticsFor(filePath, doc)))
  }

  void connection.sendDiagnostics({ uri: doc.uri, diagnostics })
}

// A configuration (or a dimensions file it names) changed: what the workspace
// compiles, and how, may have changed everywhere - re-read it whole.
async function reloadConfigs(): Promise<void> {
  configs.clear()
  await registry.rebuild()
  analyzerHost.seed(roots, exclude)

  for (const meta of registry.metas()) {
    analyzerHost.addMeta(meta)
  }

  publishConfigErrors()
  await watchTypeProjects()
  await watchConfigs()
}

// A broken configuration counts as none, so the editor and the build disagree
// until it is fixed - so its error shows on the file at fault, where it is fixed.
function publishConfigErrors(): void {
  const current = new Set<string>()

  for (const error of configs.errors()) {
    const open = openDocumentOf(error.file)
    const uri = open?.uri ?? pathToFileURL(error.file).href
    const text = open?.getText() ?? NODE_CONFIG_HOST.readFile(error.file) ?? ""
    const at = TextDocument.create(uri, "jsonc", 0, text).positionAt(error.offset ?? 0)

    current.add(uri)
    connection.console.warn(`[hx] ${error.code}: ${error.message}`)
    void connection.sendDiagnostics({
      uri,
      diagnostics: [
        {
          range: { start: at, end: at },
          severity: DiagnosticSeverity.Error,
          code: error.code,
          source: "heleonix",
          message: error.message,
        },
      ],
    })
  }

  for (const uri of configErrorUris) {
    if (!current.has(uri)) {
      void connection.sendDiagnostics({ uri, diagnostics: [] })
    }
  }

  configErrorUris = current
}

function refreshAllDiagnostics(): void {
  for (const doc of documents.all()) {
    if (!isConfigDocument(doc)) {
      validate(doc)
    }
  }
}

// What a document's file can see: its package's scope (the package and its
// dependencies) - the whole workspace for a file no package owns.
async function context(doc: TextDocument): Promise<ILanguageContext> {
  const filePath = uriToPath(doc.uri)

  return {
    index: registry.getIndex(analyzerHost.packageScope(filePath)),
    // The unresolved-reference family migrated to the shared analyzer (codes
    // HX_ANALYZER_0001-0003, severity from the same setting) - the legacy
    // in-service check stays off so findings are never doubled.
    unknownReferenceSeverity: undefined,
    unusedEntrySeverity: toDiagnosticSeverity(configs.levelOf(UNUSED_ENTRY_CODE, "information", filePath)),
    ...(await analyzerHost.snapshot(filePath)),
  }
}

// --- Helpers -----------------------------------------------------------------

function collectRoots(params: { workspaceFolders?: { uri: string }[] | null; rootUri?: string | null }): string[] {
  const uris = params.workspaceFolders?.map((folder) => folder.uri) ?? (params.rootUri ? [params.rootUri] : [])
  const result: string[] = []

  for (const uri of uris) {
    const filePath = uriToPath(uri)

    if (filePath) {
      result.push(filePath)
    }
  }

  return result
}

function isConfigFile(filePath: string): boolean {
  return path.basename(filePath) === HX_CONFIG_FILE || configs.isInput(filePath)
}

function isConfigDocument(doc: TextDocument): boolean {
  const filePath = uriToPath(doc.uri)

  return filePath !== undefined && isConfigFile(filePath)
}

function openDocumentOf(file: string): TextDocument | undefined {
  const target = path.resolve(file)

  return documents.all().find((doc) => {
    const filePath = uriToPath(doc.uri)

    return (
      filePath !== undefined &&
      (process.platform === "win32" ? filePath.toLowerCase() === target.toLowerCase() : filePath === target)
    )
  })
}

// The files declaring the workspace's packages and their TypeScript projects.
function isTypeProjectFile(name: string): boolean {
  return (
    ["package.json", "pnpm-workspace.yaml", "lerna.json"].includes(name) ||
    (name.startsWith("tsconfig") && name.endsWith(".json"))
  )
}

function uriToPath(uri: string): string | undefined {
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}

function buildExternalWatchers(sources: readonly string[], root: string): FileSystemWatcher[] {
  const watchers: FileSystemWatcher[] = LOCKFILES.map((name) => ({ globPattern: `**/${name}`, kind: WATCH_ALL }))

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
      kind: WATCH_ALL,
    })
  }

  return watchers
}

documents.listen(connection)
connection.listen()
