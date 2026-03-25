import { execAsync } from "ags/process"
import type { CommandProvider, CommandResult } from "./types"
import { parseVpnConnectionsAsync } from "../../vpn/parse-vpn-config"
import { isWindscribeAvailable, fetchLocations } from "../../vpn/parse-windscribe"

export const vpnProvider: CommandProvider = {
  category: "vpn",
  label: "VPN",
  icon: "network-vpn-symbolic",
  async fetch(): Promise<CommandResult[]> {
    const results: CommandResult[] = []

    const connections = await parseVpnConnectionsAsync()
    results.push(...connections.map((conn) => ({
      id: `vpn:${conn.name}`,
      category: "vpn" as const,
      name: `OC: ${conn.name}`,
      description: `${conn.server} (${conn.user})`,
      icon: "network-vpn-symbolic",
      keywords:
        `${conn.name} ${conn.server} ${conn.user} vpn openconnect connect`.toLowerCase(),
      execute: () => {
        execAsync(["oc", "c", conn.name])
      },
    })))

    if (isWindscribeAvailable()) {
      const locations = await fetchLocations()
      results.push(...locations.map((loc) => ({
        id: `ws:${loc.nickname}`,
        category: "vpn" as const,
        name: `WS: ${loc.nickname}`,
        description: loc.region
          ? loc.city
            ? `${loc.region} > ${loc.city}`
            : loc.region
          : "Best location",
        icon: "security-high-symbolic",
        keywords:
          `${loc.region} ${loc.city} ${loc.nickname} vpn windscribe connect`.toLowerCase(),
        execute: () => {
          execAsync(["windscribe-cli", "connect", loc.nickname])
        },
      })))
    }

    return results
  },
}
