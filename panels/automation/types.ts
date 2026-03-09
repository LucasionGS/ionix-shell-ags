export type TriggerType =
  | "workspace-change"
  | "power-state"
  | "wifi-network"
  | "time-based"
  | "window-opened"
  | "custom-command"

export interface TriggerWorkspaceChange {
  type: "workspace-change"
  workspaceName: string
}

export interface TriggerPowerState {
  type: "power-state"
  state: "plugged" | "unplugged"
}

export interface TriggerWifiNetwork {
  type: "wifi-network"
  ssid: string
}

export interface TriggerTimeBased {
  type: "time-based"
  hour: number
  minute: number
  days?: number[]
}

export interface TriggerWindowOpened {
  type: "window-opened"
  windowClass: string
}

export interface TriggerCustomCommand {
  type: "custom-command"
  command: string
  expectedOutput: string
}

export type Trigger =
  | TriggerWorkspaceChange
  | TriggerPowerState
  | TriggerWifiNetwork
  | TriggerTimeBased
  | TriggerWindowOpened
  | TriggerCustomCommand

export interface ActionShellCommand {
  type: "shell-command"
  command: string
}

export interface ActionDockerToggle {
  type: "docker-toggle"
  container: string
  action: "start" | "stop"
}

export interface ActionVpnConnect {
  type: "vpn-connect"
  name: string
}

export interface ActionVpnDisconnect {
  type: "vpn-disconnect"
}

export interface ActionHyprlandDispatch {
  type: "hyprland-dispatch"
  dispatcher: string
  arg: string
}

export interface ActionNotification {
  type: "notification"
  summary: string
  body: string
}

export type Action =
  | ActionShellCommand
  | ActionDockerToggle
  | ActionVpnConnect
  | ActionVpnDisconnect
  | ActionHyprlandDispatch
  | ActionNotification

export interface AutomationRule {
  id: string
  name: string
  trigger: Trigger
  actions: Action[]
  enabled: boolean
  lastTriggered?: string
}

export interface AutomationConfig {
  rules: AutomationRule[]
}
