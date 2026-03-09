import { execAsync } from "ags/process"
import type { CommandProvider } from "./types"
import { parseVpnConnections } from "../../vpn/parse-vpn-config"

export const vpnProvider: CommandProvider = {
  category: "vpn",
  label: "VPN",
  icon: "network-vpn-symbolic",
  fetch() {
    const connections = parseVpnConnections()
    return connections.map((conn) => ({
      id: `vpn:${conn.name}`,
      category: "vpn" as const,
      name: `VPN: ${conn.name}`,
      description: `${conn.server} (${conn.user})`,
      icon: "network-vpn-symbolic",
      keywords:
        `${conn.name} ${conn.server} ${conn.user} vpn connect`.toLowerCase(),
      execute: () => {
        execAsync(["oc", "c", conn.name])
      },
    }))
  },
}
