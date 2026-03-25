import { Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import {
  listLightsAsync,
  hueToRgb,
  gdkColorToHex,
  type HueLight,
} from "./hue-utils"

export function LightsTab(visible: Accessor<boolean>, hide: () => void, isActive: Accessor<boolean>) {
  const [lights, setLights] = createState<HueLight[]>([])
  const [query, setQuery] = createState("")
  const [selectedIndex, setSelectedIndex] = createState(0)
  const [colorTarget, setColorTarget] = createState<HueLight | null>(null)

  let chooserWidget: Gtk.ColorChooserWidget | null = null

  function refresh() {
    listLightsAsync().then(setLights).catch(() => {})
  }

  visible.subscribe(() => { if (visible()) refresh() })

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    const all = lights()
    if (q === "") return all
    return all.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.id.toString().includes(q),
    )
  })

  function toggleLight(light: HueLight) {
    execAsync(["hue", light.on ? "off" : "on", light.id.toString()])
      .then(() => refresh())
      .catch(() => {})
  }

  let brightnessTimeout: ReturnType<typeof setTimeout> | null = null
  function setBrightness(lightId: number, value: number) {
    if (brightnessTimeout) clearTimeout(brightnessTimeout)
    brightnessTimeout = setTimeout(() => {
      execAsync(["hue", "brightness", lightId.toString(), value.toString()])
        .catch(() => {})
    }, 300)
  }

  function applyColor() {
    const target = colorTarget()
    if (!target || !chooserWidget) return
    const hex = gdkColorToHex(chooserWidget.get_rgba())
    execAsync(["hue", "color", target.id.toString(), hex])
      .then(() => { setColorTarget(null); refresh() })
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
      if (results.length > 0 && idx < results.length) toggleLight(results[idx])
      return
    }
    if (keyval === Gdk.KEY_Down) {
      const len = filtered().length
      if (len > 0) setSelectedIndex(Math.min(selectedIndex() + 1, len - 1))
      return
    }
    if (keyval === Gdk.KEY_Up) {
      setSelectedIndex(Math.max(selectedIndex() - 1, 0))
      return
    }
  }

  return (
    <box vertical>
      <box class="hue-header">
        <label class="hue-title" label="Lights" xalign={0} hexpand />
        <label
          class="hue-count"
          label={lights((l) => {
            const on = l.filter((x) => x.on).length
            return `${on}/${l.length}`
          })}
        />
        <button class="hue-refresh-btn" onClicked={() => refresh()}>
          <icon icon="view-refresh-symbolic" />
        </button>
      </box>

      <entry
        class="hue-search"
        placeholder_text="Search lights..."
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

      {/* Horizontal split: list on left, color picker on right */}
      <box hexpand vexpand>
        <scrollable
          class="hue-list-scroll"
          vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
          hscrollbar_policy={Gtk.PolicyType.NEVER}
          hexpand
          vexpand
        >
          <box class="hue-list" vertical>
            <For each={filtered} id={(l) => `${l.id}-${l.on}-${l.brightness}`}>
              {(light, index) => {
                const [r, g, b] = hueToRgb(light.hue, light.saturation, light.brightness)
                const itemClass = createMemo(() =>
                  index() === selectedIndex()
                    ? light.on ? "hue-light-card on selected" : "hue-light-card off selected"
                    : light.on ? "hue-light-card on" : "hue-light-card off"
                )

                return (
                  <box class={itemClass} vertical>
                    <box class="hue-light-header">
                      <label
                        class="hue-light-swatch"
                        label={"\u25CF"}
                        css={light.on ? `color: rgb(${r}, ${g}, ${b}); font-size: 1.4em;` : "color: #555; font-size: 1.4em;"}
                      />
                      <label class="hue-light-name" label={light.name} xalign={0} hexpand />
                      <button
                        class={light.on ? "hue-toggle on" : "hue-toggle off"}
                        onClicked={() => toggleLight(light)}
                      >
                        <label label={light.on ? "ON" : "OFF"} />
                      </button>
                    </box>

                    {light.on && (
                      <box class="hue-brightness-row">
                        <icon icon="display-brightness-symbolic" />
                        <slider
                          hexpand
                          min={0}
                          max={254}
                          value={light.brightness}
                          onDragged={(self) => setBrightness(light.id, Math.round(self.value))}
                        />
                        <label class="hue-brightness-value" label={light.brightness.toString()} />
                      </box>
                    )}

                    {light.on && (
                      <box class="hue-color-row">
                        <button class="hue-color-btn" onClicked={() => setColorTarget(light)}>
                          <box>
                            <icon icon="color-select-symbolic" />
                            <label label="Color" />
                          </box>
                        </button>
                      </box>
                    )}
                  </box>
                )
              }}
            </For>
          </box>
        </scrollable>

        {/* Color picker — right side panel */}
        <box
          class="hue-color-picker-side"
          vertical
          visible={createMemo(() => colorTarget() !== null)}
        >
          <box class="hue-color-picker-header">
            <label
              label={createMemo(() => colorTarget()?.name ?? "")}
              hexpand
              xalign={0}
            />
            <button class="hue-color-picker-close" onClicked={() => setColorTarget(null)}>
              <icon icon="window-close-symbolic" />
            </button>
          </box>
          <box
            class="hue-color-chooser-container"
            $={(self) => {
              const chooser = new Gtk.ColorChooserWidget({
                use_alpha: false,
                show_editor: true,
              })
              chooser.show_all()
              self.add(chooser)
              chooserWidget = chooser
            }}
          />
          <button class="hue-color-apply" onClicked={() => applyColor()}>
            <box>
              <icon icon="emblem-ok-symbolic" />
              <label label="Apply" />
            </box>
          </button>
        </box>
      </box>

      <box class="hue-footer">
        <label
          class="hue-footer-hint"
          label={filtered((f) => `${f.length} light${f.length !== 1 ? "s" : ""}`)}
          xalign={0}
          hexpand
        />
        <label class="hue-footer-keys" label="Enter toggle  |  Tab switch  |  Esc close" />
      </box>
    </box>
  )
}
