import { togglePanel } from "../../panel-toggle"
import type { CommandProvider, CommandResult } from "./types"

const PANELS: { id: string; name: string; icon: string; keywords: string }[] = [
  {
    id: "ssh",
    name: "SSH Panel",
    icon: "network-server-symbolic",
    keywords: "ssh panel remote server connect",
  },
  {
    id: "vpn",
    name: "VPN Panel",
    icon: "network-vpn-symbolic",
    keywords: "vpn panel network connect",
  },
  {
    id: "docker",
    name: "Docker Panel",
    icon: "system-run-symbolic",
    keywords: "docker panel containers",
  },
  {
    id: "booru",
    name: "Booru Browser",
    icon: "image-x-generic-symbolic",
    keywords: "booru panel images konachan browse wallpaper",
  },
  {
    id: "automation",
    name: "Automation Panel",
    icon: "system-run-symbolic",
    keywords: "automation panel rules triggers",
  },
  {
    id: "hue",
    name: "Philips Hue Panel",
    icon: "lightbulb-symbolic",
    keywords: "hue panel philips hue lights control",
  }
]

const PANEL_COMMANDS: CommandResult[] = PANELS.map((p) => ({
  id: `panel:${p.id}`,
  category: "panel" as const,
  name: p.name,
  description: `Toggle ${p.name}`,
  icon: p.icon,
  keywords: p.keywords,
  execute: () => togglePanel(p.id),
}))

export const panelsProvider: CommandProvider = {
  category: "panel",
  label: "Panels",
  icon: "view-grid-symbolic",
  fetch: () => PANEL_COMMANDS,
}
