import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import { createPoll } from "ags/time"
import {
  fetchLocations,
  getWindscribeStatus,
  type WindscribeLocation,
  type WindscribeStatus,
} from "./parse-windscribe"

export function WindscribeTab(visible: Accessor<boolean>, hide: () => void, isActive: Accessor<boolean>) {
  const [locations, setLocations] = createState<WindscribeLocation[]>([])
  const [query, setQuery] = createState("")
  const [selectedIndex, setSelectedIndex] = createState(0)
  const [connecting, setConnecting] = createState(false)

  let locationsFetched = false
  const maybeLoad = () => {
    if (visible() && isActive() && !locationsFetched) {
      locationsFetched = true
      fetchLocations().then(setLocations)
    }
  }
  visible.subscribe(maybeLoad)
  isActive.subscribe(maybeLoad)

  const wsStatus = createPoll<WindscribeStatus>(getWindscribeStatus(), 3000, () => getWindscribeStatus())

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    const locs = locations()
    if (q === "") return locs
    return locs.filter(
      (l) =>
        l.region.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.nickname.toLowerCase().includes(q),
    )
  })

  function connectLocation(loc: WindscribeLocation) {
    if (connecting()) return
    setConnecting(true)
    execAsync(["windscribe-cli", "connect", loc.nickname])
      .then(() => {
        setConnecting(false)
        hide()
      })
      .catch(() => setConnecting(false))
  }

  function disconnect() {
    if (connecting()) return
    setConnecting(true)
    execAsync(["windscribe-cli", "disconnect"])
      .then(() => setConnecting(false))
      .catch(() => setConnecting(false))
  }

  function toggleFirewall() {
    const current = wsStatus()
    execAsync(["windscribe-cli", "firewall", current.firewallOn ? "off" : "on"])
      .catch(() => {})
  }

  let unbounce = false

  function onKeyPress(_: Gtk.Entry, event: Gdk.EventKey) {
    const keyval = event.get_keyval()[1]

    if (unbounce) return
    unbounce = true
    setTimeout(() => { unbounce = false }, 0)

    if (keyval === Gdk.KEY_Return) {
      const results = filtered()
      const idx = selectedIndex()
      if (results.length > 0 && idx < results.length) {
        connectLocation(results[idx])
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
    const s = wsStatus()
    if (connecting()) return "Connecting..."
    if (!s.loggedIn) return "Not logged in"
    return s.connected ? "Connected" : "Disconnected"
  })

  const statusClass = createMemo(() => {
    const s = wsStatus()
    if (connecting()) return "vpn-status connecting"
    if (!s.loggedIn) return "vpn-status disconnected"
    return s.connected ? "vpn-status connected" : "vpn-status disconnected"
  })

  const locationId = (loc: WindscribeLocation) =>
    loc.nickname || `${loc.region}-${loc.city}`

  return (
    <box vertical>
      <box class="vpn-header" vertical>
        <box>
          <label class="vpn-title" label="Windscribe" xalign={0} hexpand />
          <box class={statusClass}>
            <label label={statusLabel} />
          </box>
        </box>

        <box class="ws-info-row">
          <button
            class="vpn-disconnect-btn"
            visible={createMemo(() => wsStatus().connected && !connecting())}
            onClicked={() => disconnect()}
          >
            <box>
              <icon icon="network-offline-symbolic" />
              <label label="Disconnect" />
            </box>
          </button>

          <button
            class={createMemo(() =>
              wsStatus().firewallOn ? "ws-firewall-btn on" : "ws-firewall-btn off"
            )}
            onClicked={() => toggleFirewall()}
          >
            <box>
              <icon icon="security-high-symbolic" />
              <label label={createMemo(() => wsStatus().firewallOn ? "Firewall ON" : "Firewall OFF")} />
            </box>
          </button>

          <label
            class="ws-data-usage"
            label={createMemo(() => {
              const usage = wsStatus().dataUsage
              return usage ? usage : ""
            })}
            visible={createMemo(() => wsStatus().dataUsage !== "")}
            hexpand
            xalign={1}
          />
        </box>

        {/* Not logged in message */}
        <label
          class="ws-not-logged-in"
          label="Not logged in. Run: windscribe-cli login"
          visible={createMemo(() => !wsStatus().loggedIn && !connecting())}
        />

        <entry
          class="vpn-search"
          placeholder_text="Search locations..."
          onChanged={(self) => {
            setQuery(self.get_text())
            setSelectedIndex(0)
          }}
          $={(self) => {
            const focus = () => {
              if (visible() && isActive()) {
                self.set_text("")
                setQuery("")
                setSelectedIndex(0)
                self.grab_focus()
              }
            }
            visible.subscribe(focus)
            isActive.subscribe(focus)
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
          <For each={filtered} id={locationId}>
            {(loc, index) => {
              const itemClass = createMemo(() =>
                index() === selectedIndex() ? "vpn-item selected" : "vpn-item"
              )
              const subtitle = loc.region
                ? loc.city
                  ? `${loc.region} > ${loc.city}`
                  : loc.region
                : ""

              return (
                <button
                  class={itemClass}
                  onClicked={() => connectLocation(loc)}
                >
                  <box vertical>
                    <box>
                      <icon
                        class="vpn-item-icon"
                        icon="security-high-symbolic"
                      />
                      <label class="vpn-item-name" label={loc.nickname} xalign={0} hexpand />
                      {loc.bandwidth && (
                        <label class="ws-bandwidth" label={loc.bandwidth} />
                      )}
                    </box>
                    {subtitle && (
                      <box class="vpn-item-details">
                        <label
                          class="vpn-item-server"
                          label={subtitle}
                          xalign={0}
                        />
                      </box>
                    )}
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
          label={filtered((f) => `${f.length} location${f.length !== 1 ? "s" : ""}`)}
          xalign={0}
          hexpand
        />
        <label class="vpn-footer-keys" label="Enter connect  |  Tab switch  |  Esc close" />
      </box>
    </box>
  )
}
