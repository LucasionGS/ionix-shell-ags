import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"
import { parseSshConfigAsync } from "../../ssh/parse-ssh-config"

export const sshProvider: CommandProvider = {
  category: "ssh",
  label: "SSH",
  icon: "network-server-symbolic",
  async fetch(): Promise<CommandResult[]> {
    const hosts = await parseSshConfigAsync()
    return hosts.map((host) => ({
      id: `ssh:${host.name}`,
      category: "ssh" as const,
      name: host.name,
      description: [
        host.user ? `${host.user}@` : "",
        host.hostname,
        host.port ? `:${host.port}` : "",
      ].join(""),
      icon: "network-server-symbolic",
      keywords:
        `${host.name} ${host.hostname ?? ""} ${host.user ?? ""} ${host.group ?? ""} ssh`.toLowerCase(),
      execute: () => {
        execAsync(["kitty", "kitten", "ssh", host.name])
      },
    }))
  },
}
