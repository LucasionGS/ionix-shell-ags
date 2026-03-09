import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"

const MOD_BITS: [number, string][] = [
  [64, "Super"],
  [8, "Alt"],
  [4, "Ctrl"],
  [1, "Shift"],
]

function decodeMods(mask: number): string {
  return MOD_BITS.filter(([bit]) => mask & bit)
    .map(([, name]) => name)
    .join("+")
}

export const keybindsProvider: CommandProvider = {
  category: "keybind",
  label: "Keybindings",
  icon: "input-keyboard-symbolic",
  async fetch(): Promise<CommandResult[]> {
    try {
      const output = await execAsync("hyprctl binds -j")
      const binds = JSON.parse(output)
      return binds
        .filter(
          (b: { dispatcher: string }) =>
            b.dispatcher !== "" && b.dispatcher !== "submap",
        )
        .map(
          (b: {
            modmask: number
            key: string
            dispatcher: string
            arg: string
            description: string
          }) => {
            const mods = decodeMods(b.modmask)
            const shortcut = mods ? `${mods}+${b.key}` : b.key
            const desc = b.description || `${b.dispatcher} ${b.arg}`.trim()
            return {
              id: `keybind:${shortcut}:${b.dispatcher}`,
              category: "keybind" as const,
              name: desc || shortcut,
              description: shortcut,
              icon: "input-keyboard-symbolic",
              keywords:
                `${shortcut} ${b.dispatcher} ${b.arg} ${desc}`.toLowerCase(),
              execute: () => {
                execAsync([
                  "hyprctl",
                  "dispatch",
                  b.dispatcher,
                  b.arg,
                ])
              },
            }
          },
        )
    } catch {
      return []
    }
  },
}
