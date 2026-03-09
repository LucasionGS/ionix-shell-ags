import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import { createPoll } from "ags/time"
import { parseVpnConnections, getVpnStatus, type VpnConnection } from "./parse-vpn-config"

export function VpnPanel(visible: Accessor<boolean>, hide: () => void) {
  const connections = parseVpnConnections()
  const [query, setQuery] = createState("")
  const [selectedIndex, setSelectedIndex] = createState(0)
  const [connecting, setConnecting] = createState(false)
  const [primaryName, setPrimaryName] = createState(
    connections.find((c) => c.isPrimary)?.name ?? "",
  )

  function setPrimary(conn: VpnConnection) {
    execAsync(["oc", "sp", conn.name]).then(() => {
      setPrimaryName(conn.name)
    }).catch(() => {})
  }

  // Poll VPN status every 3 seconds
  const vpnStatus = createPoll(getVpnStatus(), 3000, () => {
    const status = getVpnStatus()
    return status
  })

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    if (q === "") return connections
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.server.toLowerCase().includes(q),
    )
  })

  function connectVpn(conn: VpnConnection) {
    if (connecting()) return
    setConnecting(true)
    execAsync(["oc", "c", conn.name]).then(() => {
      setConnecting(false)
      hide()
    }).catch(() => {
      setConnecting(false)
    })
  }

  function disconnectVpn() {
    if (connecting()) return
    setConnecting(true)
    execAsync(["oc", "dc"]).then(() => {
      setConnecting(false)
    }).catch(() => {
      setConnecting(false)
    })
  }

  let unbounce = false

  function onKeyPress(source: Astal.EventBox | Gtk.Entry, event: Gdk.EventKey) {
    const keyval = event.get_keyval()[1]

    if (unbounce) return
    unbounce = true
    setTimeout(() => { unbounce = false }, 0)

    if (keyval === Gdk.KEY_Escape) {
      hide()
      return
    }

    if (keyval === Gdk.KEY_Return) {
      const results = filtered()
      const idx = selectedIndex()
      if (results.length > 0 && idx < results.length) {
        connectVpn(results[idx])
      }
      return
    }

    if (keyval === Gdk.KEY_Down) {
      const len = filtered().length
      if (len > 0) {
        setSelectedIndex(Math.min(selectedIndex() + 1, len - 1))
      }
      return
    }

    if (keyval === Gdk.KEY_Up) {
      setSelectedIndex(Math.max(selectedIndex() - 1, 0))
      return
    }
  }

  const statusLabel = createMemo(() => {
    if (connecting()) return "Connecting..."
    return vpnStatus() ? "Connected" : "Disconnected"
  })

  const statusClass = createMemo(() => {
    if (connecting()) return "vpn-status connecting"
    return vpnStatus() ? "vpn-status connected" : "vpn-status disconnected"
  })

  return (
    <eventbox
      onKeyPressEvent={(self, event) => onKeyPress(self, event)}
      onButtonPressEvent={(self, event) => {
        const [, x, y] = event.get_coords()
        const card = self.get_children()[0]?.get_children()[0]
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
      <box class="vpn-panel-backdrop" halign={Gtk.Align.FILL} valign={Gtk.Align.FILL}>
        <box
          class="vpn-panel"
          vertical
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          hexpand
          vexpand
        >
          <box class="vpn-header" vertical>
            <box>
              <label class="vpn-title" label="VPN" xalign={0} hexpand />
              <box class={statusClass}>
                <label label={statusLabel} />
              </box>
            </box>

            <button
              class="vpn-disconnect-btn"
              visible={createMemo(() => vpnStatus() && !connecting())}
              onClicked={() => disconnectVpn()}
            >
              <box>
                <icon icon="network-offline-symbolic" />
                <label label="Disconnect" />
              </box>
            </button>

            <entry
              class="vpn-search"
              placeholder_text="Search connections..."
              onChanged={(self) => {
                setQuery(self.get_text())
                setSelectedIndex(0)
              }}
              $={(self) => {
                visible.subscribe(() => {
                  if (visible()) {
                    self.set_text("")
                    setQuery("")
                    setSelectedIndex(0)
                    self.grab_focus()
                  }
                })
              }}
              onKeyPressEvent={(self, event) => onKeyPress(self, event)}
            />
          </box>

          <scrollable
            class="vpn-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="vpn-list" vertical>
              <For each={filtered} id={(conn) => conn.name}>
                {(conn, index) => {
                  const itemClass = createMemo(() =>
                    index() === selectedIndex() ? "vpn-item selected" : "vpn-item"
                  )
                  return (
                    <button
                      class={itemClass}
                      onClicked={() => connectVpn(conn)}
                      onButtonPressEvent={(_, event) => {
                        const [, button] = event.get_button()
                        if (button === 3) {
                          setPrimary(conn)
                          return true
                        }
                        return false
                      }}
                    >
                      <box vertical>
                        <box>
                          <icon
                            class="vpn-item-icon"
                            icon="network-vpn-symbolic"
                          />
                          <label class="vpn-item-name" label={conn.name} xalign={0} hexpand />
                          <label
                            class="vpn-item-primary"
                            label="primary"
                            visible={createMemo(() => conn.name === primaryName())}
                          />
                          {conn.sso && (
                            <label class="vpn-item-sso" label="SSO" />
                          )}
                        </box>
                        <box class="vpn-item-details">
                          <label
                            class="vpn-item-server"
                            label={conn.server}
                            xalign={0}
                          />
                        </box>
                      </box>
                    </button>
                  )
                }}
              </For>
            </box>
          </scrollable>

          <box class="vpn-footer">
            <label
              class="vpn-footer-hint"
              label={filtered((f) => `${f.length} connection${f.length !== 1 ? "s" : ""}`)}
              xalign={0}
              hexpand
            />
            <label class="vpn-footer-keys" label="Enter connect  |  Right-click set primary  |  Esc close" />
          </box>
        </box>
      </box>
    </eventbox>
  )
}
