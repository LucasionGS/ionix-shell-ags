import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"

const SYSTEM_COMMANDS: CommandResult[] = [
  {
    id: "system:lock",
    category: "system",
    name: "Lock Screen",
    description: "Lock with hyprlock",
    icon: "system-lock-screen-symbolic",
    keywords: "lock screen hyprlock",
    execute: () => { execAsync("hyprlock") },
  },
  {
    id: "system:reload",
    category: "system",
    name: "Reload Hyprland",
    description: "Reload Hyprland configuration",
    icon: "view-refresh-symbolic",
    keywords: "reload hyprland config restart",
    execute: () => { execAsync("hyprctl reload") },
  },
  {
    id: "system:screenshot-region",
    category: "system",
    name: "Screenshot Region",
    description: "Select a region to capture",
    icon: "accessories-screenshot-symbolic",
    keywords: "screenshot region capture screen grab",
    execute: () => { execAsync(["hyprshot", "-m", "region"]) },
  },
  {
    id: "system:screenshot-window",
    category: "system",
    name: "Screenshot Window",
    description: "Capture the active window",
    icon: "accessories-screenshot-symbolic",
    keywords: "screenshot window capture screen grab",
    execute: () => { execAsync(["hyprshot", "-m", "window"]) },
  },
  {
    id: "system:screenshot-monitor",
    category: "system",
    name: "Screenshot Monitor",
    description: "Capture the entire monitor",
    icon: "accessories-screenshot-symbolic",
    keywords: "screenshot monitor capture screen grab fullscreen",
    execute: () => { execAsync(["hyprshot", "-m", "output"]) },
  },
  {
    id: "system:toggle-float",
    category: "system",
    name: "Toggle Floating",
    description: "Toggle floating for the active window",
    icon: "focus-windows-symbolic",
    keywords: "toggle floating window tiling",
    execute: () => { execAsync(["hyprctl", "dispatch", "togglefloating"]) },
  },
  {
    id: "system:fullscreen",
    category: "system",
    name: "Fullscreen",
    description: "Toggle fullscreen for the active window",
    icon: "view-fullscreen-symbolic",
    keywords: "fullscreen maximize window",
    execute: () => { execAsync(["hyprctl", "dispatch", "fullscreen", "0"]) },
  },
  {
    id: "system:kill-window",
    category: "system",
    name: "Close Window",
    description: "Close the active window",
    icon: "window-close-symbolic",
    keywords: "close kill window quit",
    execute: () => { execAsync(["hyprctl", "dispatch", "killactive"]) },
  },
  {
    id: "system:pin",
    category: "system",
    name: "Pin Window",
    description: "Pin the active window on top",
    icon: "view-pin-symbolic",
    keywords: "pin window always on top sticky",
    execute: () => { execAsync(["hyprctl", "dispatch", "pin"]) },
  },
  {
    id: "system:clipboard",
    category: "system",
    name: "Clipboard History",
    description: "Open CopyQ clipboard manager",
    icon: "edit-paste-symbolic",
    keywords: "clipboard history paste copy copyq",
    execute: () => { execAsync(["copyq", "toggle"]) },
  },
  {
    id: "system:wallpaper",
    category: "system",
    name: "Change Wallpaper",
    description: "Cycle to next wallpaper",
    icon: "preferences-desktop-wallpaper-symbolic",
    keywords: "wallpaper background change cycle",
    execute: () => {
      execAsync(
        `${GLib.get_home_dir()}/.config/archion/cron/cycle-wallpaper.sh`,
      )
    },
  },
]

import GLib from "gi://GLib"

export const systemProvider: CommandProvider = {
  category: "system",
  label: "System",
  icon: "preferences-system-symbolic",
  fetch: () => SYSTEM_COMMANDS,
}
