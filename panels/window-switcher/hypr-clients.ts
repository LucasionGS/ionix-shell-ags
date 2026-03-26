import GLib from "gi://GLib"
import { execAsync, subprocess } from "ags/process"
import { createState } from "gnim"

export interface HyprClient {
  address: string
  title: string
  class: string
  workspace: { id: number; name: string }
  focusHistoryID: number
  mapped: boolean
}

// Events that require a clients refresh
const REFRESH_EVENTS = new Set([
  "openwindow",
  "closewindow",
  "movewindow",
  "windowtitle",
  "focusedmon",
  "activewindow",
  "changefloatingmode",
  "minimize",
])

const [clients, setClients] = createState<HyprClient[]>([])

export { clients }

async function fetchClients(): Promise<void> {
  try {
    const out = await execAsync("hyprctl clients -j")
    const list: HyprClient[] = JSON.parse(out)
    setClients(
      list
        .filter((c) => c.mapped && c.title && c.workspace.id >= 0)
        .sort((a, b) => a.focusHistoryID - b.focusHistoryID),
    )
  } catch {
    // keep stale cache on error
  }
}

function connect(): void {
  const sig = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")
  const runtimeDir = GLib.getenv("XDG_RUNTIME_DIR")
  if (!sig || !runtimeDir) return

  const socketPath = `${runtimeDir}/hypr/${sig}/.socket2.sock`

  try {
    subprocess(
      ["socat", "-u", `UNIX-CONNECT:${socketPath}`, "STDOUT"],
      (line) => {
        const [event] = line.split(">>", 1)
        if (REFRESH_EVENTS.has(event)) {
          fetchClients()
        }
      },
    )
  } catch (e) {
    print(`hypr-clients: failed to connect to socket: ${e}`)
  }
}

// Initial fetch + start listening
fetchClients()
connect()
