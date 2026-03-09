import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"

export const windowsProvider: CommandProvider = {
  category: "window",
  label: "Windows",
  icon: "focus-windows-symbolic",
  async fetch(): Promise<CommandResult[]> {
    try {
      const output = await execAsync("hyprctl clients -j")
      const clients = JSON.parse(output)
      return clients
        .filter(
          (c: { mapped: boolean; title: string }) => c.mapped && c.title,
        )
        .map(
          (c: {
            address: string
            title: string
            class: string
            workspace: { name: string }
          }) => ({
            id: `window:${c.address}`,
            category: "window" as const,
            name: c.title,
            description: `${c.class} \u2014 workspace ${c.workspace?.name ?? "?"}`,
            icon: "focus-windows-symbolic",
            keywords:
              `${c.title} ${c.class} ${c.workspace?.name ?? ""} window switch focus`.toLowerCase(),
            execute: () => {
              execAsync([
                "hyprctl",
                "dispatch",
                "focuswindow",
                `address:${c.address}`,
              ])
            },
          }),
        )
    } catch {
      return []
    }
  },
}
