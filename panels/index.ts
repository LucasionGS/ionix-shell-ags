import type { PanelDefinition } from "./types"
import { SshPanel } from "./ssh/SshPanel"
import { VpnPanel } from "./vpn/VpnPanel"
import { DockerPanel } from "./docker/DockerPanel"
import { CommandPalette } from "./command-palette/CommandPalette"
import { AutomationPanel } from "./automation/AutomationPanel"
import { Astal } from "ags/gtk3"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

const panels: PanelDefinition[] = [
  {
    id: "ssh",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: SshPanel,
  },
  {
    id: "vpn",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: VpnPanel,
  },
  {
    id: "docker",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: DockerPanel,
  },
  {
    id: "command-palette",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: CommandPalette,
  },
  {
    id: "automation",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: AutomationPanel,
  },
]

export default panels
