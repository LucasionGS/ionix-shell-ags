import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import type { CommandProvider, CommandResult } from "./types"
import { generalSettings } from "../../settings/general-settings"

async function listScripts(dirPath: string): Promise<CommandResult[]> {
  try {
    const output = await execAsync(["ls", "-1", dirPath])
    return output
      .trim()
      .split("\n")
      .filter((name) => name && !name.startsWith("."))
      .map((name) => {
        const fullPath = `${dirPath}/${name}`
        return {
          id: `script:${fullPath}`,
          category: "script" as const,
          name: name.replace(/\.(sh|py|fish)$/, ""),
          description: fullPath,
          icon: "utilities-terminal-symbolic",
          keywords: `${name} script run execute`.toLowerCase(),
          execute: () => {
            execAsync(fullPath)
          },
        }
      })
  } catch {
    return []
  }
}

export const scriptsProvider: CommandProvider = {
  category: "script",
  label: "Scripts",
  icon: "utilities-terminal-symbolic",
  async fetch(): Promise<CommandResult[]> {
    const home = GLib.get_home_dir()
    const [a, b] = await Promise.all([
      listScripts(`${home}/.config/archion/scripts`),
      listScripts(generalSettings.get.scriptsDir()),
    ])
    return [...a, ...b]
  },
}
