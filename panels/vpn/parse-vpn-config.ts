import { readFile } from "ags/file"
import { exec } from "ags/process"
import GLib from "gi://GLib"

export interface VpnConnection {
  name: string
  server: string
  user: string
  sso: boolean
  isPrimary: boolean
}

const CONFIG_DIR = GLib.get_home_dir() + "/.config/oc"

export function parseVpnConnections(): VpnConnection[] {
  const connectionsPath = CONFIG_DIR + "/connections.txt"
  const primaryPath = CONFIG_DIR + "/primary.txt"

  let primary = ""
  try {
    primary = readFile(primaryPath).trim()
  } catch {}

  let content: string
  try {
    content = readFile(connectionsPath)
  } catch {
    return []
  }

  const connections: VpnConnection[] = []

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue

    const parts = trimmed.split("|")
    if (parts.length < 2) continue

    const [name, server, user, sso] = parts
    connections.push({
      name,
      server: server || "",
      user: user || "",
      sso: sso === "true",
      isPrimary: name === primary,
    })
  }

  return connections
}

export function getVpnStatus(): boolean {
  try {
    const output = exec("oc s")
    return output.toLowerCase().startsWith("connected to vpn")
  } catch {
    return false
  }
}
