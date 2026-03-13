import { readFile } from "ags/file"
import { exec, execAsync } from "ags/process"
import GLib from "gi://GLib"

export interface VpnConnection {
  name: string
  server: string
  user: string
  sso: boolean
  isPrimary: boolean
}

const CONFIG_DIR = GLib.get_home_dir() + "/.config/oc"
const CONNECTIONS_PATH = CONFIG_DIR + "/connections.txt"
const PRIMARY_PATH = CONFIG_DIR + "/primary.txt"

function parseVpnContent(content: string, primary: string): VpnConnection[] {
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

export function parseVpnConnections(): VpnConnection[] {
  let primary = ""
  try {
    primary = readFile(PRIMARY_PATH).trim()
  } catch {}

  let content: string
  try {
    content = readFile(CONNECTIONS_PATH)
  } catch {
    return []
  }

  return parseVpnContent(content, primary)
}

export async function parseVpnConnectionsAsync(): Promise<VpnConnection[]> {
  let primary = ""
  try {
    primary = (await execAsync(["cat", PRIMARY_PATH])).trim()
  } catch {}

  let content: string
  try {
    content = await execAsync(["cat", CONNECTIONS_PATH])
  } catch {
    return []
  }

  return parseVpnContent(content, primary)
}

export function getVpnStatus(): boolean {
  try {
    const output = exec("oc s")
    return output.toLowerCase().startsWith("connected to vpn")
  } catch {
    return false
  }
}
