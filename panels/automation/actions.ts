import { execAsync } from "ags/process"
import type { Action } from "./types"

export async function executeAction(action: Action): Promise<void> {
  switch (action.type) {
    case "shell-command":
      await execAsync(["bash", "-c", action.command])
      break
    case "docker-toggle":
      await execAsync(["docker", action.action, action.container])
      break
    case "vpn-connect":
      await execAsync(["oc", "c", action.name])
      break
    case "vpn-disconnect":
      await execAsync(["oc", "dc"])
      break
    case "hyprland-dispatch":
      await execAsync(["hyprctl", "dispatch", action.dispatcher, action.arg])
      break
    case "notification":
      await execAsync(["notify-send", action.summary, action.body])
      break
  }
}

export async function executeActions(actions: Action[]): Promise<void> {
  for (const action of actions) {
    try {
      await executeAction(action)
    } catch (e) {
      console.error(`Automation action failed: ${action.type}`, e)
    }
  }
}
