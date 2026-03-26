import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import { registerPanelAction } from "../panel-action"
import { registerSettings } from "../settings/settings-store"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import { clients as cachedClients, type HyprClient } from "./hypr-clients"

// GJS global — not in ES2023 lib but available at runtime
declare const setTimeout: (fn: () => void, ms: number) => unknown

const PREVIEW_DIR = `${GLib.get_user_cache_dir()}/ionix-shell/alttab`

const swSettings = registerSettings(
  "window-switcher",
  "Window Switcher",
  "focus-windows-symbolic",
  {
    maxColumns: {
      type: "number" as const,
      label: "Max Columns",
      description: "Maximum window thumbnails per row",
      default: 7,
      min: 1,
      max: 20,
      step: 1,
    },
    previewWidth: {
      type: "number" as const,
      label: "Preview Width",
      description: "Width of each window thumbnail in pixels",
      default: 160,
      min: 60,
      max: 400,
      step: 10,
    },
    previewHeight: {
      type: "number" as const,
      label: "Preview Height",
      description: "Height of each window thumbnail in pixels",
      default: 90,
      min: 40,
      max: 280,
      step: 10,
    },
  },
)

function ensurePreviewDir() {
  execAsync(["mkdir", "-p", PREVIEW_DIR]).catch(() => {})
}

async function capturePreview(
  address: string,
): Promise<GdkPixbuf.Pixbuf | null> {
  const path = `${PREVIEW_DIR}/${address.replace(/^0x/, "")}.png`
  try {
    await execAsync(["grim", "-t", "png", "-l", "0", "-w", address, path])
    const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(
      path,
      swSettings.get.previewWidth(),
      swSettings.get.previewHeight(),
      true,
    )
    return pb
  } catch {
    return null
  }
}

function WindowItem(props: {
  client: HyprClient
  selectedIndex: Accessor<number>
  index: Accessor<number>
  onActivate: () => void
}) {
  const { client, selectedIndex, index, onActivate } = props
  const [pixbuf, setPixbuf] = createState<GdkPixbuf.Pixbuf | null>(null)

  capturePreview(client.address).then((pb) => {
    if (pb) setPixbuf(pb)
  })

  const itemClass = createMemo(() =>
    selectedIndex() === index() ? "alttab-item selected" : "alttab-item",
  )

  return (
    <button class={itemClass} onClicked={onActivate}>
      <box vertical>
        <box
          class="alttab-preview"
          width_request={createMemo(() => swSettings.get.previewWidth())}
          height_request={createMemo(() => swSettings.get.previewHeight())}
        >
          <label
            label="..."
            hexpand
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            visible={createMemo(() => pixbuf() === null)}
          />
          <Gtk.Image
            visible={createMemo(() => pixbuf() !== null)}
            $={(self) => {
              let alive = true
              self.connect("destroy", () => { alive = false })
              pixbuf.subscribe(() => {
                if (!alive) return
                const pb = pixbuf()
                if (pb) self.set_from_pixbuf(pb)
              })
            }}
          />
        </box>
        <label
          class="alttab-label"
          label={client.title}
          max_width_chars={20}
          ellipsize={3}
          halign={Gtk.Align.CENTER}
        />
        <label
          class="alttab-class"
          label={client.class}
          max_width_chars={20}
          ellipsize={3}
          halign={Gtk.Align.CENTER}
        />
      </box>
    </button>
  )
}

export function WindowSwitcher(
  visible: Accessor<boolean>,
  hide: () => void,
  show: () => void,
) {
  const [displayedClients, setDisplayedClients] = createState<HyprClient[]>([])
  const [selectedIndex, setSelectedIndex] = createState(0)

  function open() {
    ensurePreviewDir()
    const list = cachedClients()
    setDisplayedClients(list)
    setSelectedIndex(list.length > 1 ? 1 : 0)
  }

  visible.subscribe(() => {
    if (visible()) open()
    else setDisplayedClients([])
  })

  // IPC actions: ags request -i ionix-shell window-switcher <action>
  registerPanelAction("window-switcher", (action) => {
    switch (action) {
      case "next":
        if (!visible()) {
          show() // triggers refresh() via visible.subscribe
        } else {
          next()
        }
        break
      case "prev":
        if (!visible()) {
          show()
        } else {
          prev()
        }
        break
      case "confirm":
        activate(selectedIndex())
        break
      case "cancel":
        hide()
        break
    }
  })

  function activate(idx: number) {
    const list = displayedClients()
    if (idx < 0 || idx >= list.length) return
    const c = list[idx]
    hide()
    execAsync([
      "hyprctl",
      "--batch",
      `dispatch focuswindow address:${c.address} ; dispatch alterzorder top`,
    ]).catch(() => {
      execAsync(["hyprctl", "dispatch", "focuswindow", `address:${c.address}`])
    })
  }

  function next() {
    const len = displayedClients().length
    if (len === 0) return
    setSelectedIndex((selectedIndex() + 1) % len)
  }

  function prev() {
    const len = displayedClients().length
    if (len === 0) return
    setSelectedIndex((selectedIndex() - 1 + len) % len)
  }

  let unbounce = false
  function onKeyPress(_: Astal.EventBox | Gtk.Widget, event: Gdk.EventKey) {
    if (unbounce) return
    unbounce = true
    setTimeout(() => {
      unbounce = false
    }, 0)

    const keyval = event.get_keyval()[1]

    if (keyval === Gdk.KEY_Escape) {
      hide()
      return
    }

    if (keyval === Gdk.KEY_Return) {
      activate(selectedIndex())
      return
    }

    if (
      keyval === Gdk.KEY_Tab ||
      keyval === Gdk.KEY_Right ||
      keyval === Gdk.KEY_Down
    ) {
      next()
      return
    }

    if (
      keyval === Gdk.KEY_ISO_Left_Tab ||
      keyval === Gdk.KEY_Left ||
      keyval === Gdk.KEY_Up
    ) {
      prev()
      return
    }
  }

  return (
    <eventbox
      class="alttab-backdrop"
      expand
      onKeyPressEvent={(self, event) => onKeyPress(self, event)}
      onButtonPressEvent={(self, event) => {
        const [, x, y] = event.get_coords()
        const card = (self as Astal.EventBox).get_children()[0]
          ?.get_children()[0]
        if (card) {
          const alloc = card.get_allocation()
          if (
            x < alloc.x ||
            x > alloc.x + alloc.width ||
            y < alloc.y ||
            y > alloc.y + alloc.height
          ) {
            hide()
          }
        }
      }}
    >
      <box
        class="alttab-panel"
        vertical
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
      >
        <label
          class="alttab-title"
          label="SWITCH WINDOW"
          xalign={0}
        />
        <Gtk.FlowBox
          halign={Gtk.Align.CENTER}
          max_children_per_line={createMemo(() => swSettings.get.maxColumns())}
          min_children_per_line={1}
          selection_mode={Gtk.SelectionMode.NONE}
          homogeneous
          row_spacing={8}
          column_spacing={8}
        >
          <For each={displayedClients}>
            {(client, index) => (
              <WindowItem
                client={client}
                selectedIndex={selectedIndex}
                index={index}
                onActivate={() => activate(index())}
              />
            )}
          </For>
        </Gtk.FlowBox>
      </box>
    </eventbox>
  )
}
