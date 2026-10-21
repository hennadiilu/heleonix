import path from "node:path"
import { JsoncParser } from "@heleonix/hx-compiler-core"
import type { IDimensionDefinition } from "@heleonix/hx-language"
import type { DiagnosticLevel } from "./DiagnosticLevel"
import { HX_CONFIG_FILE } from "./HX_CONFIG_FILE"
import type { IHxConfig } from "./IHxConfig"
import type { IHxConfigHost } from "./IHxConfigHost"
import type { IHxConfigResult } from "./IHxConfigResult"
import { NODE_CONFIG_HOST } from "./NODE_CONFIG_HOST"
import { Errors } from "./errors/Errors"
import { HeleonixPluginError } from "./errors/HeleonixPluginError"

const LEVELS: ReadonlySet<string> = new Set<DiagnosticLevel>(["error", "warning", "information", "hint", "off"])

type RawConfig = Record<string, unknown>

interface IReading {
  readonly host: IHxConfigHost

  readonly files: string[]

  readonly missing: string[]

  // The file being read when a failure happens.
  current: string
}

// A failure while reading the current file, carrying where in it when the parser knows.
class ConfigFailure extends Error {
  public constructor(
    public readonly error: HeleonixPluginError,
    public readonly offset?: number,
  ) {
    super(error.message)
  }
}

/**
 * The configuration governing a directory: the nearest `hx.config.json` at or above it, merged over those it
 * `extends` (a path, a folder holding one, or a file of an installed package). Relative paths resolve against the
 * file declaring them, as in `tsconfig`. Never throws: a failure is reported in the result, which also lists every
 * file read and every place a configuration was looked for in vain, for a host to watch.
 */
export function loadHxConfig(fromDir: string, host: IHxConfigHost = NODE_CONFIG_HOST): IHxConfigResult {
  const reading: IReading = { host, files: [], missing: [], current: "" }

  for (let current = path.resolve(fromDir); ; current = path.dirname(current)) {
    const file = path.join(current, HX_CONFIG_FILE)

    if (host.readFile(file) !== undefined) {
      try {
        return { config: readConfig(file, [], reading), files: reading.files, missing: reading.missing }
      } catch (failure) {
        const error = failure instanceof ConfigFailure ? failure.error : (failure as Error)
        const code = (error as { code?: string }).code ?? Errors.invalidConfig.code
        const offset = failure instanceof ConfigFailure ? failure.offset : undefined

        return {
          files: reading.files,
          missing: reading.missing,
          error: {
            file: reading.current,
            code,
            message: error.message || code,
            ...(offset === undefined ? {} : { offset }),
          },
        }
      }
    }

    reading.missing.push(file)

    if (path.dirname(current) === current) {
      return { files: reading.files, missing: reading.missing }
    }
  }
}

function readConfig(file: string, chain: readonly string[], reading: IReading): IHxConfig {
  reading.current = file

  if (chain.includes(file)) {
    fail(new HeleonixPluginError(Errors.configExtendsCycle, [...chain, file].join(" -> ")))
  }

  const raw = asObject(parseJson(file, reading), file, "the configuration")
  const own = resolveOwn(raw, file, reading)

  if (raw.extends === undefined) {
    return own
  }

  if (typeof raw.extends !== "string") {
    invalid(file, "'extends' must be a string")
  }

  const base = readConfig(resolveExtends(raw.extends, file, reading), [...chain, file], reading)

  reading.current = file

  return merge(base, own)
}

function resolveOwn(raw: RawConfig, file: string, reading: IReading): IHxConfig {
  const dir = path.dirname(file)
  const config: IHxConfig = { file }

  if (raw.include !== undefined) {
    config.include = strings(raw.include, "include", file).map((entry) => path.resolve(dir, entry))
  }

  if (raw.exclude !== undefined) {
    config.exclude = strings(raw.exclude, "exclude", file).map((entry) =>
      path.isAbsolute(entry) || /[\\/]/.test(entry) ? path.resolve(dir, entry) : entry,
    )
  }

  if (raw.dimensions !== undefined) {
    config.dimensions = dimensionsOf(raw.dimensions, file, reading)
  }

  if (raw.typescript !== undefined) {
    const typescript = asObject(raw.typescript, file, "'typescript'")

    config.typescript = {}

    if (typescript.projects !== undefined) {
      config.typescript.projects = { base: dir, patterns: strings(typescript.projects, "typescript.projects", file) }
    }

    if (typescript.exclude !== undefined) {
      config.typescript.exclude = { base: dir, patterns: strings(typescript.exclude, "typescript.exclude", file) }
    }

    if (typescript.linkedPackages !== undefined) {
      config.typescript.linkedPackages = boolean(typescript.linkedPackages, "typescript.linkedPackages", file)
    }
  }

  if (raw.diagnostics !== undefined) {
    const diagnostics = asObject(raw.diagnostics, file, "'diagnostics'")

    config.diagnostics = {}

    if (diagnostics.severity !== undefined) {
      config.diagnostics.severity = levels(diagnostics.severity, file)
    }

    if (diagnostics.failOnWarnings !== undefined) {
      config.diagnostics.failOnWarnings = boolean(diagnostics.failOnWarnings, "diagnostics.failOnWarnings", file)
    }
  }

  return config
}

// The nearer configuration wins key by key; severity levels merge code by code.
function merge(base: IHxConfig, own: IHxConfig): IHxConfig {
  const merged: IHxConfig = { file: own.file }
  const include = own.include ?? base.include
  const exclude = own.exclude ?? base.exclude
  const dimensions = own.dimensions ?? base.dimensions

  if (include) {
    merged.include = include
  }

  if (exclude) {
    merged.exclude = exclude
  }

  if (dimensions) {
    merged.dimensions = dimensions
  }

  if (base.typescript || own.typescript) {
    merged.typescript = { ...base.typescript, ...own.typescript }
  }

  if (base.diagnostics || own.diagnostics) {
    const severity = base.diagnostics?.severity || own.diagnostics?.severity

    merged.diagnostics = {
      ...base.diagnostics,
      ...own.diagnostics,
      ...(severity ? { severity: { ...base.diagnostics?.severity, ...own.diagnostics?.severity } } : {}),
    }
  }

  return merged
}

function resolveExtends(specifier: string, file: string, reading: IReading): string {
  const relative = specifier.startsWith(".") || path.isAbsolute(specifier)
  const target = relative ? path.resolve(path.dirname(file), specifier) : reading.host.resolvePackage(specifier, file)

  for (const candidate of target ? [target, path.join(target, HX_CONFIG_FILE)] : []) {
    if (reading.host.readFile(candidate) !== undefined) {
      return candidate
    }

    reading.missing.push(candidate)
  }

  fail(new HeleonixPluginError(Errors.configNotFound, specifier, file))
}

function dimensionsOf(value: unknown, file: string, reading: IReading): IDimensionDefinition[] {
  let source = file
  let definitions = value

  if (typeof value === "string") {
    source = path.resolve(path.dirname(file), value)
    reading.current = source
    definitions = parseJson(source, reading)
  }

  if (
    !Array.isArray(definitions) ||
    !definitions.every(
      (definition: unknown) =>
        typeof definition === "object" &&
        definition !== null &&
        typeof (definition as IDimensionDefinition).name === "string" &&
        Array.isArray((definition as IDimensionDefinition).values) &&
        (definition as IDimensionDefinition).values.every((entry) => typeof entry === "string"),
    )
  ) {
    invalid(source, "'dimensions' must be a list of { name, values } definitions")
  }

  reading.current = file

  return definitions as IDimensionDefinition[]
}

function levels(value: unknown, file: string): Record<string, DiagnosticLevel> {
  const severity = asObject(value, file, "'diagnostics.severity'")

  for (const [code, level] of Object.entries(severity)) {
    if (typeof level !== "string" || !LEVELS.has(level)) {
      invalid(file, `the level of '${code}' must be one of ${[...LEVELS].join(", ")}`)
    }
  }

  return severity as Record<string, DiagnosticLevel>
}

function parseJson(file: string, reading: IReading): unknown {
  const source = reading.host.readFile(file)

  if (!reading.files.includes(file)) {
    reading.files.push(file)
  }

  if (source === undefined) {
    reading.missing.push(file)
    invalid(file, "the file does not exist")
  }

  try {
    return new JsoncParser().parse(source)
  } catch (error) {
    fail(
      new HeleonixPluginError(Errors.invalidConfig, file, (error as Error).message),
      (error as { offset?: number }).offset,
    )
  }
}

function asObject(value: unknown, file: string, what: string): RawConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(file, `${what} must be an object`)
  }

  return value as RawConfig
}

function strings(value: unknown, key: string, file: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    invalid(file, `'${key}' must be a list of strings`)
  }

  return value
}

function boolean(value: unknown, key: string, file: string): boolean {
  if (typeof value !== "boolean") {
    invalid(file, `'${key}' must be true or false`)
  }

  return value
}

function invalid(file: string, reason: string): never {
  fail(new HeleonixPluginError(Errors.invalidConfig, file, reason))
}

function fail(error: HeleonixPluginError, offset?: number): never {
  throw new ConfigFailure(error, offset)
}
