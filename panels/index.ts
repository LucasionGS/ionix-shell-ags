import type { PanelDefinition } from "./types"
import { SshPanel } from "./ssh/SshPanel"
import { VpnPanel } from "./vpn/VpnPanel"
import { DockerPanel } from "./docker/DockerPanel"
import { CommandPalette } from "./command-palette/CommandPalette"
import { AutomationPanel } from "./automation/AutomationPanel"
import { BooruPanel } from "./booru/BooruPanel"
import { HuePanel } from "./hue/HuePanel"
import { WindowSwitcher } from "./window-switcher/WindowSwitcher"
import { SettingsPanel } from "./settings/SettingsPanel"
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
    id: "booru",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: BooruPanel,
  },
  {
    id: "automation",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: AutomationPanel,
  },
  {
    id: "hue",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.NORMAL,
    layer: Astal.Layer.OVERLAY,
    setup: HuePanel,
  },
  {
    id: "window-switcher",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.OVERLAY,
    setup: WindowSwitcher,
  },
  {
    id: "settings",
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    keymode: Astal.Keymode.ON_DEMAND,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.OVERLAY,
    setup: SettingsPanel,
  },
]

export default panels
