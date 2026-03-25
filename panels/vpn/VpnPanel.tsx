import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo } from "gnim"
import { isWindscribeAvailable } from "./parse-windscribe"
import { OcTab } from "./OcTab"
import { WindscribeTab } from "./WindscribeTab"

type VpnTabId = "oc" | "windscribe"

export function VpnPanel(visible: Accessor<boolean>, hide: () => void) {
  const hasWindscribe = isWindscribeAvailable()
  const [activeTab, setActiveTab] = createState<VpnTabId>("oc")

  const isOcActive = createMemo(() => activeTab() === "oc")
  const isWsActive = createMemo(() => activeTab() === "windscribe")

  let unbounce = false

  function onKeyPress(_: Astal.EventBox, event: Gdk.EventKey) {
    const keyval = event.get_keyval()[1]

    if (unbounce) return
    unbounce = true
    setTimeout(() => { unbounce = false }, 0)

    if (keyval === Gdk.KEY_Escape) {
      hide()
      return
    }

    if (hasWindscribe && keyval === Gdk.KEY_Tab) {
      setActiveTab(activeTab() === "oc" ? "windscribe" : "oc")
      return
    }
  }

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
          {hasWindscribe && (
            <box class="vpn-tab-bar">
              <button
                class={createMemo(() =>
                  activeTab() === "oc" ? "vpn-tab-btn active" : "vpn-tab-btn"
                )}
                onClicked={() => setActiveTab("oc")}
              >
                <box>
                  <icon icon="network-vpn-symbolic" />
                  <label label="OpenConnect" />
                </box>
              </button>
              <button
                class={createMemo(() =>
                  activeTab() === "windscribe" ? "vpn-tab-btn active" : "vpn-tab-btn"
                )}
                onClicked={() => setActiveTab("windscribe")}
              >
                <box>
                  <icon icon="security-high-symbolic" />
                  <label label="Windscribe" />
                </box>
              </button>
            </box>
          )}

          <box visible={isOcActive} vertical>
            {OcTab(visible, hide, isOcActive)}
          </box>
          {hasWindscribe && (
            <box visible={isWsActive} vertical>
              {WindscribeTab(visible, hide, isWsActive)}
            </box>
          )}
        </box>
      </box>
    </eventbox>
  )
}
