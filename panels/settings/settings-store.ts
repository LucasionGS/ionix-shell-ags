import { createState } from "gnim"
import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import type { Accessor } from "gnim"

export const CONFIG_DIR = `${GLib.get_home_dir()}/.config/ionix-shell`
const SETTINGS_PATH = `${CONFIG_DIR}/settings.json`

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingType = "string" | "boolean" | "number" | "select"

export interface SettingDef<T = unknown> {
  type: SettingType
  label: string
  description?: string
  default: T
  /** For "select" — the list of option values */
  options?: string[]
  /** For "number" */
  min?: number
  max?: number
  step?: number
}

export type SettingsSchema = Record<string, SettingDef>

/** Internal record kept in the global registry */
export interface SettingsSection {
  id: string
  label: string
  icon: string
  schema: SettingsSchema
  /** Per-key reactive [accessor, setter] pairs, not publicly typed */
  _states: Record<string, [Accessor<unknown>, (v: unknown) => void]>
}

type InferValue<D extends SettingDef> = D extends SettingDef<infer V> ? V : never

export type SettingsAccessors<S extends SettingsSchema> = {
  [K in keyof S]: Accessor<InferValue<S[K]>>
}

export type SettingsSetters<S extends SettingsSchema> = {
  [K in keyof S]: (v: InferValue<S[K]>) => void
}

export interface RegisteredSettings<S extends SettingsSchema> {
  get: SettingsAccessors<S>
  set: SettingsSetters<S>
}

// ─── Persistence ──────────────────────────────────────────────────────────────

let persisted: Record<string, Record<string, unknown>> = {}

function loadPersisted(): void {
  try {
    persisted = JSON.parse(readFile(SETTINGS_PATH))
  } catch {
    persisted = {}
  }
}

function savePersisted(): void {
  try {
    GLib.mkdir_with_parents(CONFIG_DIR, 0o755)
    writeFile(SETTINGS_PATH, JSON.stringify(persisted, null, 2))
  } catch {
    // ignore write errors — file system may not be ready
  }
}

loadPersisted()

// ─── Registry ─────────────────────────────────────────────────────────────────

const registrations: SettingsSection[] = []

/**
 * Register a group of settings for a feature/panel.
 * Call this at module load time (top-level) in each panel file.
 *
 * Returns typed reactive accessors (`get`) and setters (`set`) for each key.
 * Setters automatically persist to ~/.config/ionix-shell/settings.json.
 *
 * @example
 * const { get, set } = registerSettings("window-switcher", "Window Switcher", "preferences-system-symbolic", {
 *   maxColumns: { type: "number", label: "Max columns", default: 7, min: 1, max: 20 },
 * })
 * // get.maxColumns() → reactive number
 * // set.maxColumns(5) → updates state + persists
 */
export function registerSettings<S extends SettingsSchema>(
  id: string,
  label: string,
  icon: string,
  schema: S,
): RegisteredSettings<S> {
  const saved = persisted[id] ?? {}
  const states: Record<string, [Accessor<unknown>, (v: unknown) => void]> = {}
  const getMap: Record<string, Accessor<unknown>> = {}
  const setMap: Record<string, (v: unknown) => void> = {}

  for (const key of Object.keys(schema)) {
    const def = schema[key]
    const initial: unknown = key in saved ? saved[key] : def.default
    const [acc, setter] = createState<unknown>(initial)

    states[key] = [acc, setter]
    getMap[key] = acc
    setMap[key] = (v: unknown) => {
      setter(v as never)
      if (!persisted[id]) persisted[id] = {}
      persisted[id][key] = v
      savePersisted()
    }
  }

  registrations.push({ id, label, icon, schema, _states: states })

  return {
    get: getMap as SettingsAccessors<S>,
    set: setMap as SettingsSetters<S>,
  }
}

/** Returns the ordered list of all registered settings sections. */
export function getSettingsRegistrations(): readonly SettingsSection[] {
  return registrations
}
