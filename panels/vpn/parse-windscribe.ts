import { exec, execAsync } from "ags/process"
import GLib from "gi://GLib"

export interface WindscribeLocation {
  region: string
  city: string
  nickname: string
  bandwidth: string
}

export interface WindscribeStatus {
  connected: boolean
  connectState: string
  firewallOn: boolean
  dataUsage: string
  loggedIn: boolean
}

export function isWindscribeAvailable(): boolean {
  return GLib.find_program_in_path("windscribe-cli") !== null
}

export function parseLocationsOutput(output: string): WindscribeLocation[] {
  const locations: WindscribeLocation[] = []

  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue

    let bandwidth = ""
    let core = trimmed
    const bwMatch = trimmed.match(/\s*\(([^)]+)\)\s*$/)
    if (bwMatch) {
      bandwidth = bwMatch[1]
      core = trimmed.slice(0, bwMatch.index!).trim()
    }

    const parts = core.split(" - ")
    if (parts.length === 1) {
      locations.push({ region: "", city: "", nickname: parts[0], bandwidth })
    } else if (parts.length === 2) {
      locations.push({ region: parts[0], city: "", nickname: parts[1], bandwidth })
    } else {
      locations.push({
        region: parts[0],
        city: parts[1],
        nickname: parts.slice(2).join(" - "),
        bandwidth,
      })
    }
  }

  return locations
}

export async function fetchLocations(): Promise<WindscribeLocation[]> {
  try {
    const output = await execAsync(["windscribe-cli", "locations"])
    return parseLocationsOutput(output)
  } catch {
    return []
  }
}

export function parseStatusOutput(output: string): WindscribeStatus {
  const lines = output.split("\n")
  const get = (key: string) =>
    lines.find((l) => l.startsWith(key))?.split(":").slice(1).join(":").trim() ?? ""

  const connectState = get("Connect state")
  return {
    connected: connectState.toLowerCase().startsWith("connected"),
    connectState,
    firewallOn: get("Firewall state").toLowerCase() === "on",
    dataUsage: get("Data usage"),
    loggedIn: get("Login state").toLowerCase().includes("logged in"),
  }
}

export function getWindscribeStatus(): WindscribeStatus {
  try {
    const output = exec("windscribe-cli status")
    return parseStatusOutput(output)
  } catch {
    return {
      connected: false,
      connectState: "Unknown",
      firewallOn: false,
      dataUsage: "",
      loggedIn: false,
    }
  }
}
