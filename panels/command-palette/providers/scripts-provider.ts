import { execAsync } from "ags/process"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { CommandProvider, CommandResult } from "./types"

function listScripts(dirPath: string): CommandResult[] {
  const results: CommandResult[] = []
  try {
    const dir = Gio.File.new_for_path(dirPath)
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    let info: Gio.FileInfo | null
    while ((info = enumerator.next_file(null)) !== null) {
      const name = info.get_name()
      if (
        info.get_file_type() === Gio.FileType.REGULAR &&
        !name.startsWith(".")
      ) {
        const fullPath = `${dirPath}/${name}`
        results.push({
          id: `script:${fullPath}`,
          category: "script",
          name: name.replace(/\.(sh|py|fish)$/, ""),
          description: fullPath,
          icon: "utilities-terminal-symbolic",
          keywords: `${name} script run execute`.toLowerCase(),
          execute: () => {
            execAsync(fullPath)
          },
        })
      }
    }
  } catch {}
  return results
}

export const scriptsProvider: CommandProvider = {
  category: "script",
  label: "Scripts",
  icon: "utilities-terminal-symbolic",
  fetch() {
    const home = GLib.get_home_dir()
    return [
      ...listScripts(`${home}/.config/archion/scripts`),
      ...listScripts(`${home}/.local/bin`),
    ]
  },
}
