export type CommandCategory =
  | "app"
  | "window"
  | "keybind"
  | "ssh"
  | "vpn"
  | "docker"
  | "script"
  | "directory"
  | "system"

export interface CommandResult {
  id: string
  category: CommandCategory
  name: string
  description: string
  icon: string
  keywords: string
  execute: () => void
}

export interface CommandProvider {
  category: CommandCategory
  label: string
  icon: string
  fetch(): CommandResult[] | Promise<CommandResult[]>
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  app: "Applications",
  window: "Windows",
  keybind: "Keybindings",
  ssh: "SSH",
  vpn: "VPN",
  docker: "Docker",
  script: "Scripts",
  directory: "Directories",
  system: "System",
}

export const CATEGORY_ICONS: Record<CommandCategory, string> = {
  app: "application-x-executable-symbolic",
  window: "focus-windows-symbolic",
  keybind: "input-keyboard-symbolic",
  ssh: "network-server-symbolic",
  vpn: "network-vpn-symbolic",
  docker: "system-run-symbolic",
  script: "utilities-terminal-symbolic",
  directory: "folder-symbolic",
  system: "preferences-system-symbolic",
}
