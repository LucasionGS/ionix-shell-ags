import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import { registerPanelAction } from "../panel-action"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"

// GJS global — not in ES2023 lib but available at runtime
declare const setTimeout: (fn: () => void, ms: number) => unknown

interface HyprClient {
  address: string
  title: string
  class: string
  workspace: { id: number; name: string }
  focusHistoryID: number
  mapped: boolean
}

const PREVIEW_DIR = `${GLib.get_user_cache_dir()}/ionix-shell/alttab`
const PREVIEW_W = 160
const PREVIEW_H = 90

async function ensurePreviewDir() {
  await execAsync(["mkdir", "-p", PREVIEW_DIR])
}

async function getClients(): Promise<HyprClient[]> {
  try {
    const out = await execAsync("hyprctl clients -j")
    const clients: HyprClient[] = JSON.parse(out)
    return clients
      .filter((c) => c.mapped && c.title && c.workspace.id >= 0)
      .sort((a, b) => a.focusHistoryID - b.focusHistoryID)
  } catch {
    return []
  }
}

async function capturePreview(
  address: string,
): Promise<GdkPixbuf.Pixbuf | null> {
  const path = `${PREVIEW_DIR}/${address.replace(/^0x/, "")}.png`
  try {
    await execAsync(["grim", "-t", "png", "-l", "0", "-w", address, path])
    const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(
      path,
      PREVIEW_W,
      PREVIEW_H,
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
          width_request={PREVIEW_W}
          height_request={PREVIEW_H}
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
              pixbuf.subscribe(() => {
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
  const [clients, setClients] = createState<HyprClient[]>([])
  const [selectedIndex, setSelectedIndex] = createState(0)

  async function refresh() {
    await ensurePreviewDir()
    const list = await getClients()
    setClients(list)
    // Windows-style: start selection at index 1 (previous window),
    // since focusHistoryID 0 is the currently active window.
    setSelectedIndex(list.length > 1 ? 1 : 0)
  }

  visible.subscribe(() => {
    if (visible()) {
      refresh()
    } else {
      setClients([])
    }
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
    const list = clients()
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
    const len = clients().length
    if (len === 0) return
    setSelectedIndex((selectedIndex() + 1) % len)
  }

  function prev() {
    const len = clients().length
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
      <box halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand>
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
          <box class="alttab-grid" halign={Gtk.Align.CENTER}>
            <For each={clients}>
              {(client, index) => (
                <WindowItem
                  client={client}
                  selectedIndex={selectedIndex}
                  index={index}
                  onActivate={() => activate(index())}
                />
              )}
            </For>
          </box>
        </box>
      </box>
    </eventbox>
  )
}
