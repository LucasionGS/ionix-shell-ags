import { exec, execAsync } from "ags/process"
import { Gdk } from "ags/gtk3"

export interface HueLight {
  id: number
  name: string
  on: boolean
  brightness: number
  hue: number
  saturation: number
}

export interface HueGroup {
  name: string
  lightCount: number
}

export interface HueScene {
  name: string
  commandCount: number
}

export interface SceneCommand {
  index: number
  type: string
  target: string
  args: string[]
  raw: string
}

export function parseLightListOutput(output: string): HueLight[] {
  const lights: HueLight[] = []
  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (
      trimmed === "" ||
      trimmed.startsWith("Hue Lights:") ||
      trimmed.startsWith("ID") ||
      trimmed.startsWith("--")
    ) continue

    const parts = trimmed.split("\t").map((p) => p.trim()).filter((p) => p !== "")
    if (parts.length < 6) continue

    lights.push({
      id: parseInt(parts[0], 10),
      name: parts[1],
      on: parts[2] === "true",
      brightness: parseInt(parts[3], 10),
      hue: parseInt(parts[4], 10),
      saturation: parseInt(parts[5], 10),
    })
  }
  return lights
}

export function parseGroupsOutput(output: string): HueGroup[] {
  const groups: HueGroup[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(.+?)\s+\((\d+)\s+lights?\)/)
    if (match) {
      groups.push({ name: match[1], lightCount: parseInt(match[2], 10) })
    }
  }
  return groups
}

export function parseScenesOutput(output: string): HueScene[] {
  const scenes: HueScene[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(.+?)\s+\((\d+)\s+commands?\)/)
    if (match) {
      scenes.push({ name: match[1], commandCount: parseInt(match[2], 10) })
    }
  }
  return scenes
}

export function parseSceneCommandsOutput(output: string): SceneCommand[] {
  const commands: SceneCommand[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(\d+)\.\s+(\w+)\s+(.*)$/)
    if (!match) continue

    const index = parseInt(match[1], 10)
    const type = match[2]
    const rest = match[3].trim()

    // Parse target and args from the rest
    // Target can be quoted: "g:room" or unquoted: 1
    let target: string
    let args: string[]
    const quotedMatch = rest.match(/^"([^"]+)"\s*(.*)$/)
    if (quotedMatch) {
      target = quotedMatch[1]
      args = quotedMatch[2].trim().split(/\s+/).filter((a) => a !== "")
    } else {
      const parts = rest.split(/\s+/)
      target = parts[0] ?? ""
      args = parts.slice(1)
    }

    commands.push({ index, type, target, args, raw: `${type} ${rest}` })
  }
  return commands
}

export function parseGroupLightsOutput(output: string): string[] {
  const lights: string[] = []
  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "" || trimmed.startsWith("Group ")) continue
    // Format: "1. Light Name (ID: 8)"
    const match = trimmed.match(/^\d+\.\s+(.+?)\s+\(ID:\s*\d+\)/)
    if (match) {
      lights.push(match[1])
    }
  }
  return lights
}

export function listLights(): HueLight[] {
  try {
    return parseLightListOutput(exec("hue list"))
  } catch {
    return []
  }
}

export async function listLightsAsync(): Promise<HueLight[]> {
  try {
    const output = await execAsync(["hue", "list"])
    return parseLightListOutput(output)
  } catch {
    return []
  }
}

export function listGroups(): HueGroup[] {
  try {
    return parseGroupsOutput(exec("hue group groups"))
  } catch {
    return []
  }
}

export async function listGroupsAsync(): Promise<HueGroup[]> {
  try {
    const output = await execAsync(["hue", "group", "groups"])
    return parseGroupsOutput(output)
  } catch {
    return []
  }
}

export function listScenes(): HueScene[] {
  try {
    return parseScenesOutput(exec("hue scene scenes"))
  } catch {
    return []
  }
}

export async function listScenesAsync(): Promise<HueScene[]> {
  try {
    const output = await execAsync(["hue", "scene", "scenes"])
    return parseScenesOutput(output)
  } catch {
    return []
  }
}

export async function fetchGroupLightsAsync(name: string): Promise<string[]> {
  try {
    const output = await execAsync(["hue", "group", "list", name])
    return parseGroupLightsOutput(output)
  } catch {
    return []
  }
}

export async function fetchSceneCommandsAsync(name: string): Promise<SceneCommand[]> {
  try {
    const output = await execAsync(["hue", "scene", "list", name])
    return parseSceneCommandsOutput(output)
  } catch {
    return []
  }
}

// Convert Hue bridge HSB to RGB
// hue: 0-65535, saturation: 0-254, brightness: 0-254
export function hueToRgb(hue: number, saturation: number, brightness: number): [number, number, number] {
  const h = hue / 65535
  const s = saturation / 254
  const v = brightness / 254

  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function gdkColorToHex(color: Gdk.RGBA): string {
  const r = Math.round(color.red * 255)
  const g = Math.round(color.green * 255)
  const b = Math.round(color.blue * 255)
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  )
}
