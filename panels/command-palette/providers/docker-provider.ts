import { execAsync } from "ags/process"
import type { CommandProvider } from "./types"
import { listContainers, formatPorts } from "../../docker/docker-utils"

export const dockerProvider: CommandProvider = {
  category: "docker",
  label: "Docker",
  icon: "system-run-symbolic",
  fetch() {
    const containers = listContainers()
    return containers.map((c) => {
      const isRunning = c.state === "running"
      const action = isRunning ? "Stop" : "Start"
      const ports = formatPorts(c.ports)
      return {
        id: `docker:${c.id}`,
        category: "docker" as const,
        name: `${action}: ${c.name}`,
        description: [c.image, ports].filter(Boolean).join(" | "),
        icon: isRunning
          ? "media-playback-stop-symbolic"
          : "media-playback-start-symbolic",
        keywords:
          `${c.name} ${c.image} ${c.project} docker container ${action}`.toLowerCase(),
        execute: () => {
          execAsync(["docker", isRunning ? "stop" : "start", c.name])
        },
      }
    })
  },
}
