import { readFile } from "ags/file"
import GLib from "gi://GLib"

export interface SshHost {
  name: string
  hostname: string
  user: string
  port?: number
  proxyJump?: string
  group?: string
}

export function parseSshConfig(): SshHost[] {
  const configPath = GLib.get_home_dir() + "/.ssh/config"

  let content: string
  try {
    content = readFile(configPath)
  } catch {
    return []
  }

  const hosts: SshHost[] = []
  let current: Partial<SshHost> | null = null
  let lastComment = ""

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()

    if (line.startsWith("#")) {
      lastComment = line.replace(/^#\s*/, "")
      continue
    }

    if (line === "") continue

    const match = line.match(/^(\w+)\s+(.+)$/)
    if (!match) continue

    const [, key, value] = match

    switch (key.toLowerCase()) {
      case "host":
        // Flush previous host
        if (current?.name && current?.hostname && current?.user) {
          hosts.push(current as SshHost)
        }
        // Skip wildcards
        if (value.includes("*")) {
          current = null
          break
        }
        current = { name: value, group: lastComment || undefined }
        lastComment = ""
        break
      case "hostname":
        if (current) current.hostname = value
        break
      case "user":
        if (current) current.user = value
        break
      case "port":
        if (current) current.port = parseInt(value, 10)
        break
      case "proxyjump":
        if (current) current.proxyJump = value
        break
    }
  }

  // Flush last entry
  if (current?.name && current?.hostname && current?.user) {
    hosts.push(current as SshHost)
  }

  return hosts
}
