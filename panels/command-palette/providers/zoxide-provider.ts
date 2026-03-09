import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"

export const zoxideProvider: CommandProvider = {
  category: "directory",
  label: "Directories",
  icon: "folder-symbolic",
  async fetch(): Promise<CommandResult[]> {
    try {
      const output = await execAsync("zoxide query --list")
      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 30)
        .map((dir) => {
          const short = dir.replace(/^\/home\/[^/]+/, "~")
          const name = dir.split("/").pop() ?? dir
          return {
            id: `directory:${dir}`,
            category: "directory" as const,
            name,
            description: short,
            icon: "folder-symbolic",
            keywords: `${dir} ${name} directory folder open cd`.toLowerCase(),
            execute: () => {
              execAsync(["kitty", "--directory", dir])
            },
          }
        })
    } catch {
      return []
    }
  },
}
