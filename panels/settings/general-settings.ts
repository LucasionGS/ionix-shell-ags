import GLib from "gi://GLib"
import { registerSettings } from "./settings-store"

const HOME = GLib.get_home_dir() ?? "/home/user"

/**
 * General / app-wide settings.
 * Imported by any module that needs the terminal or scripts directory.
 */
export const generalSettings = registerSettings(
  "general",
  "General",
  "preferences-system-symbolic",
  {
    terminal: {
      type: "select" as const,
      label: "Terminal Emulator",
      description: "Used for SSH connections and script execution",
      default: "kitty",
      options: ["kitty", "alacritty", "wezterm", "foot", "ghostty"],
    },
    scriptsDir: {
      type: "string" as const,
      label: "Scripts Directory",
      description: "Directory scanned for user scripts in the command palette",
      default: `${HOME}/.local/bin`,
    },
  },
)
