import GLib from "gi://GLib"
import { readFile } from "ags/file"
import { exec, subprocess } from "ags/process"
import { loadRules } from "./rule-store"
import { executeActions } from "./actions"
import type { AutomationRule } from "./types"

let _instance: AutomationEngine | null = null

export function getEngine(): AutomationEngine {
  if (!_instance) _instance = new AutomationEngine()
  return _instance
}

export class AutomationEngine {
  private rules: AutomationRule[] = []
  private pollTimer: number = 0
  private lastPowerState = ""
  private lastSsid = ""
  private firedTimeRules = new Set<string>()

  start(): void {
    this.rules = loadRules()
    this.connectHyprlandSocket()
    this.pollTimer = setInterval(() => this.pollCheck(), 30_000) as unknown as number
    setTimeout(() => this.pollCheck(), 2000)
  }

  reload(): void {
    this.rules = loadRules()
  }

  private connectHyprlandSocket(): void {
    const sig = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")
    const runtimeDir = GLib.getenv("XDG_RUNTIME_DIR")
    if (!sig || !runtimeDir) return

    const socketPath = `${runtimeDir}/hypr/${sig}/.socket2.sock`

    try {
      subprocess(
        ["socat", "-u", `UNIX-CONNECT:${socketPath}`, "STDOUT"],
        (line) => this.handleHyprEvent(line),
      )
    } catch (e) {
      console.error("Failed to connect to Hyprland socket:", e)
    }
  }

  private handleHyprEvent(line: string): void {
    const [event, data] = line.split(">>", 2)

    for (const rule of this.rules) {
      if (!rule.enabled) continue

      if (
        rule.trigger.type === "workspace-change" &&
        event === "workspace"
      ) {
        if (data === rule.trigger.workspaceName) {
          this.fireRule(rule)
        }
      }

      if (
        rule.trigger.type === "window-opened" &&
        event === "openwindow"
      ) {
        const parts = data?.split(",") ?? []
        const windowClass = parts[2] ?? ""
        if (windowClass === rule.trigger.windowClass) {
          this.fireRule(rule)
        }
      }
    }
  }

  private pollCheck(): void {
    this.checkPowerState()
    this.checkWifi()
    this.checkTimeBased()
    this.checkCustomCommands()
  }

  private checkPowerState(): void {
    const state = this.getPowerState()
    if (state === this.lastPowerState) return
    this.lastPowerState = state

    for (const rule of this.rules) {
      if (!rule.enabled || rule.trigger.type !== "power-state") continue
      if (rule.trigger.state === state) {
        this.fireRule(rule)
      }
    }
  }

  private checkWifi(): void {
    const ssid = this.getSsid()
    if (ssid === this.lastSsid) return
    this.lastSsid = ssid

    for (const rule of this.rules) {
      if (!rule.enabled || rule.trigger.type !== "wifi-network") continue
      if (rule.trigger.ssid === ssid) {
        this.fireRule(rule)
      }
    }
  }

  private checkTimeBased(): void {
    const now = new Date()
    const currentMinuteKey = `${now.getHours()}:${now.getMinutes()}`

    for (const rule of this.rules) {
      if (!rule.enabled || rule.trigger.type !== "time-based") continue
      const timeKey = `${rule.trigger.hour}:${rule.trigger.minute}`
      const firedKey = `${rule.id}:${currentMinuteKey}`

      if (timeKey === currentMinuteKey && !this.firedTimeRules.has(firedKey)) {
        if (
          !rule.trigger.days ||
          rule.trigger.days.includes(now.getDay())
        ) {
          this.firedTimeRules.add(firedKey)
          this.fireRule(rule)
        }
      }
    }

    if (this.firedTimeRules.size > 500) {
      this.firedTimeRules.clear()
    }
  }

  private checkCustomCommands(): void {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.trigger.type !== "custom-command") continue
      try {
        const output = exec(["bash", "-c", rule.trigger.command]).trim()
        if (output === rule.trigger.expectedOutput) {
          this.fireRule(rule)
        }
      } catch {}
    }
  }

  private getPowerState(): "plugged" | "unplugged" {
    try {
      const status = readFile(
        "/sys/class/power_supply/BAT0/status",
      ).trim()
      return status === "Discharging" ? "unplugged" : "plugged"
    } catch {
      return "plugged"
    }
  }

  private getSsid(): string {
    try {
      const output = exec("nmcli -t -f active,ssid dev wifi")
      for (const line of output.split("\n")) {
        if (line.startsWith("yes:")) return line.slice(4)
      }
    } catch {}
    return ""
  }

  private fireRule(rule: AutomationRule): void {
    rule.lastTriggered = new Date().toISOString()
    executeActions(rule.actions)
  }
}
