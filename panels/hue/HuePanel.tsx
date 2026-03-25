import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo } from "gnim"
import { LightsTab } from "./LightsTab"
import { GroupsTab } from "./GroupsTab"
import { ScenesTab } from "./ScenesTab"

type HueTabId = "lights" | "groups" | "scenes"

const TABS: { id: HueTabId; label: string; icon: string }[] = [
  { id: "lights", label: "Lights", icon: "dialog-information-symbolic" },
  { id: "groups", label: "Groups", icon: "view-list-symbolic" },
  { id: "scenes", label: "Scenes", icon: "media-playlist-consecutive-symbolic" },
]

export function HuePanel(visible: Accessor<boolean>, hide: () => void) {
  const [activeTab, setActiveTab] = createState<HueTabId>("lights")

  const isLightsActive = createMemo(() => activeTab() === "lights")
  const isGroupsActive = createMemo(() => activeTab() === "groups")
  const isScenesActive = createMemo(() => activeTab() === "scenes")

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

    if (keyval === Gdk.KEY_Tab) {
      const order: HueTabId[] = ["lights", "groups", "scenes"]
      const idx = order.indexOf(activeTab())
      setActiveTab(order[(idx + 1) % order.length])
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
      <box class="hue-panel-backdrop" halign={Gtk.Align.FILL} valign={Gtk.Align.FILL}>
        <box
          class="hue-panel"
          vertical
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          hexpand
          vexpand
        >
          <box class="hue-tab-bar">
            {TABS.map((tab) => (
              <button
                class={createMemo(() =>
                  activeTab() === tab.id ? "hue-tab-btn active" : "hue-tab-btn"
                )}
                onClicked={() => setActiveTab(tab.id)}
              >
                <box>
                  <icon icon={tab.icon} />
                  <label label={tab.label} />
                </box>
              </button>
            ))}
          </box>

          <box visible={isLightsActive} vertical>
            {LightsTab(visible, hide, isLightsActive)}
          </box>
          <box visible={isGroupsActive} vertical>
            {GroupsTab(visible, hide, isGroupsActive)}
          </box>
          <box visible={isScenesActive} vertical>
            {ScenesTab(visible, hide, isScenesActive)}
          </box>
        </box>
      </box>
    </eventbox>
  )
}
