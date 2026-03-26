import { Gtk, Gdk, Astal } from "ags/gtk3"
import { createState, For, type Accessor } from "gnim"
import Gio from "gi://Gio"
import GioUnix from "gi://GioUnix"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import { registerSettings, type SettingsSchema } from "../settings/settings-store"

const DEFAULT_DESKTOP_DIR = `${GLib.get_home_dir()}/Desktop`

// ─── Monitor discovery ────────────────────────────────────────────────────────

interface MonitorInfo {
  index: number
  gdk: Gdk.Monitor | null
  id: string
  label: string
}

function discoverMonitors(): MonitorInfo[] {
  const display = Gdk.Display.get_default()
  if (!display) return [{ index: 0, gdk: null, id: "mon0", label: "Monitor 0" }]
  const n = display.get_n_monitors()
  const result: MonitorInfo[] = []
  for (let i = 0; i < n; i++) {
    try {
      const gdk = display.get_monitor(i)
      const model = gdk?.get_model() ?? ""
      const mfr = gdk?.get_manufacturer() ?? ""
      const label = [mfr, model].filter(Boolean).join(" ") || `Monitor ${i}`
      const id = `mon${i}` + (model ? `_${model.replace(/\W+/g, "_").toLowerCase()}` : "")
      result.push({ index: i, gdk: gdk ?? null, id, label })
    } catch {
      result.push({ index: i, gdk: null, id: `mon${i}`, label: `Monitor ${i}` })
    }
  }
  return result.length > 0 ? result : [{ index: 0, gdk: null, id: "mon0", label: "Monitor 0" }]
}

const detectedMonitors = discoverMonitors()

// ─── Settings ─────────────────────────────────────────────────────────────────

const schema: SettingsSchema = {
  enabled: {
    type: "boolean" as const,
    label: "Enable Desktop",
    description: "Show icons on the desktop layer",
    default: true,
  },
  iconSize: {
    type: "number" as const,
    label: "Icon Size",
    description: "Size of desktop icons in pixels",
    default: 48,
    min: 16,
    max: 96,
    step: 8,
  },
}

for (const mon of detectedMonitors) {
  schema[`${mon.id}_enabled`] = {
    type: "boolean" as const,
    label: `${mon.label} — Show Icons`,
    description: "Show desktop icons on this monitor",
    default: true,
  }
  schema[`${mon.id}_dir`] = {
    type: "string" as const,
    label: `${mon.label} — Desktop Path`,
    description: "Folder shown as desktop on this monitor",
    default: DEFAULT_DESKTOP_DIR,
  }
}

const desktopSettings = registerSettings("desktop", "Desktop", "user-desktop-symbolic", schema)

export const desktopEnabled = desktopSettings.get.enabled as Accessor<boolean>

function iconSize() {
  return desktopSettings.get.iconSize() as number
}

interface DesktopEntry {
  name: string
  icon: GdkPixbuf.Pixbuf | null
  launch: () => void
}

function getIconPixbuf(
  iconObj: Gio.Icon | null,
  fallback: string,
): GdkPixbuf.Pixbuf | null {
  const theme = Gtk.IconTheme.get_default()
  try {
    if (iconObj) {
      const info = theme.lookup_by_gicon(iconObj, iconSize(), 0)
      if (info) return info.load_icon()
    }
    const info2 = theme.lookup_icon(fallback, iconSize(), 0)
    if (info2) return info2.load_icon()
  } catch {
    // fall through
  }
  return null
}

function loadDesktopEntries(dirPath: string): DesktopEntry[] {
  const dir = Gio.File.new_for_path(dirPath)
  const entries: DesktopEntry[] = []

  try {
    const iter = dir.enumerate_children(
      "standard::*",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )
    let info: Gio.FileInfo | null
    while ((info = iter.next_file(null)) !== null) {
      const name = info.get_name()
      if (!name || name.startsWith(".")) continue

      const file = dir.get_child(name)
      const uri = file.get_uri()
      const contentType = info.get_content_type() ?? ""

      // .desktop file — parse and launch the app it references
      if (name.endsWith(".desktop")) {
      const appInfo = GioUnix.DesktopAppInfo.new_from_filename(
          file.get_path()!,
        )
        if (!appInfo) continue
        const displayName =
          appInfo.get_display_name() ?? appInfo.get_name() ?? name
        const iconObj = appInfo.get_icon()
        entries.push({
          name: displayName,
          icon: getIconPixbuf(iconObj, "application-x-executable"),
          launch: () => {
            try {
              appInfo.launch([], null)
            } catch {}
          },
        })
      } else {
        // Regular file or directory — open with default app
        const displayName = info.get_display_name() ?? name
        const iconObj = Gio.content_type_get_icon(contentType)
        // For image files, use the image itself as the thumbnail
        let icon: GdkPixbuf.Pixbuf | null = null
        if (contentType.startsWith("image/")) {
          try {
            icon = GdkPixbuf.Pixbuf.new_from_file_at_scale(
              file.get_path()!,
              iconSize(),
              iconSize(),
              true,
            )
          } catch {
            // fall back to content-type icon below
          }
        }
        if (!icon) {
          icon = getIconPixbuf(
            iconObj,
            contentType.startsWith("inode/directory") ? "folder" : "text-x-generic",
          )
        }
        entries.push({
          name: displayName,
          icon,
          launch: () => {
            try {
              Gio.AppInfo.launch_default_for_uri(uri, null)
            } catch {}
          },
        })
      }
    }
  } catch {
    // Desktop dir may not exist yet — return empty
  }

  return entries
}

function DesktopIcon(entry: DesktopEntry) {
  return (
    <button class="desktop-icon" onClicked={entry.launch}>
      <box vertical halign={Gtk.Align.CENTER}>
        <Gtk.Image
          class="desktop-icon-image"
          $={(self) => {
            if (entry.icon) self.set_from_pixbuf(entry.icon)
            else self.set_from_icon_name("text-x-generic", Gtk.IconSize.DIALOG)
          }}
        />
        <label
          class="desktop-icon-label"
          label={entry.name}
          max_width_chars={10}
          ellipsize={3}
          halign={Gtk.Align.CENTER}
          justify={Gtk.Justification.CENTER}
          wrap
        />
      </box>
    </button>
  )
}

function MonitorDesktopPanel(dirAccessor: Accessor<string>) {
  const [entries, setEntries] = createState<DesktopEntry[]>(
    loadDesktopEntries(dirAccessor()),
  )

  let fileMonitor: Gio.FileMonitor | null = null
  function watchDir(dirPath: string) {
    if (fileMonitor) {
      try { fileMonitor.cancel() } catch {}
      fileMonitor = null
    }
    try {
      const dirFile = Gio.File.new_for_path(dirPath)
      fileMonitor = dirFile.monitor_directory(Gio.FileMonitorFlags.NONE, null)
      fileMonitor.connect("changed", () => setEntries(loadDesktopEntries(dirPath)))
    } catch {}
  }

  watchDir(dirAccessor())

  dirAccessor.subscribe(() => {
    const dir = dirAccessor()
    setEntries(loadDesktopEntries(dir))
    watchDir(dir)
  })

  desktopSettings.get.iconSize.subscribe(() => {
    setEntries(loadDesktopEntries(dirAccessor()))
  })

  return (
    <box class="desktop-grid" halign={Gtk.Align.START} valign={Gtk.Align.START} hexpand vexpand>
      <Gtk.FlowBox
        halign={Gtk.Align.START}
        valign={Gtk.Align.START}
        max_children_per_line={1}
        min_children_per_line={1}
        selection_mode={Gtk.SelectionMode.NONE}
        orientation={Gtk.Orientation.VERTICAL}
        row_spacing={4}
        column_spacing={4}
        homogeneous
      >
        <For each={entries}>
          {(entry) => <DesktopIcon {...entry} />}
        </For>
      </Gtk.FlowBox>
    </box>
  )
}

export function createDesktopWindows(application: Astal.Application) {
  const globalEnabled = desktopSettings.get.enabled as Accessor<boolean>

  for (const mon of detectedMonitors) {
    const monEnabled = desktopSettings.get[`${mon.id}_enabled`] as Accessor<boolean>
    const monDir = desktopSettings.get[`${mon.id}_dir`] as Accessor<string>

    const isVisible = () => (globalEnabled() as unknown as boolean) && (monEnabled() as unknown as boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      name: `desktop-${mon.index}`,
      application,
      anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM |
              Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT,
      keymode: Astal.Keymode.NONE,
      exclusivity: Astal.Exclusivity.NORMAL,
      layer: Astal.Layer.BOTTOM,
      visible: isVisible(),
    }
    if (mon.gdk) params.gdkmonitor = mon.gdk

    const win = new Astal.Window(params)
    win.add(MonitorDesktopPanel(monDir))

    const updateVisible = () => { win.visible = isVisible() }
    globalEnabled.subscribe(updateVisible)
    monEnabled.subscribe(updateVisible)
  }
}
