import { readFile, writeFile } from "ags/file"
import GLib from "gi://GLib"
import type { AutomationConfig, AutomationRule } from "./types"

const CONFIG_DIR = GLib.get_home_dir() + "/.config/ion-ags"
const CONFIG_PATH = CONFIG_DIR + "/automations.json"

export function loadRules(): AutomationRule[] {
  try {
    const content = readFile(CONFIG_PATH)
    const config: AutomationConfig = JSON.parse(content)
    return config.rules ?? []
  } catch {
    return []
  }
}

export function saveRules(rules: AutomationRule[]): void {
  const dir = GLib.get_home_dir() + "/.config/ion-ags"
  GLib.mkdir_with_parents(dir, 0o755)
  const config: AutomationConfig = { rules }
  writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}
