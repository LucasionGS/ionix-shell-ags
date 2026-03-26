import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo } from "gnim"
import {
  getSettingsRegistrations,
  type SettingDef,
  type SettingsSection,
} from "./settings-store"

// ─── Individual setting controls ──────────────────────────────────────────────

function StringControl(props: {
  acc: Accessor<unknown>
  setter: (v: unknown) => void
}) {
  return (
    <entry
      class="settings-entry"
      hexpand
      $={(self: Gtk.Entry) => self.set_text(String(props.acc()))}
      onChanged={(self: Gtk.Entry) => props.setter(self.get_text())}
    />
  )
}

function BooleanControl(props: {
  acc: Accessor<unknown>
  setter: (v: unknown) => void
}) {
  return (
    <button
      class={createMemo(() =>
        props.acc() ? "settings-toggle active" : "settings-toggle",
      )}
      onClicked={() => props.setter(!props.acc())}
    >
      <label label={createMemo(() => (props.acc() ? "On" : "Off"))} />
    </button>
  )
}

function NumberControl(props: {
  def: SettingDef
  acc: Accessor<unknown>
  setter: (v: unknown) => void
}) {
  const { def, acc, setter } = props

  function commit(raw: string) {
    const n = parseFloat(raw)
    if (isNaN(n)) return
    let v = n
    if (def.min !== undefined) v = Math.max(def.min, v)
    if (def.max !== undefined) v = Math.min(def.max, v)
    setter(v)
  }

  function step(delta: number) {
    const cur = Number(acc())
    commit(String(cur + (def.step ?? 1) * delta))
  }

  return (
    <box class="settings-number-control">
      <button class="settings-step-btn" onClicked={() => step(-1)}>
        <label label="−" />
      </button>
      <entry
        class="settings-entry settings-entry-number"
        width_chars={6}
        $={(self: Gtk.Entry) => {
          self.set_text(String(acc()))
          acc.subscribe(() => {
            // Only update if the entry doesn't currently have focus
            // (so we don't clobber the user's in-progress typing)
            if (!self.has_focus) {
              self.set_text(String(acc()))
            }
          })
        }}
        onActivate={(self: Gtk.Entry) => {
          commit(self.get_text())
          self.set_text(String(acc()))
        }}
        onFocusOutEvent={(self: Gtk.Widget) => {
          commit((self as Gtk.Entry).get_text())
          ;(self as Gtk.Entry).set_text(String(acc()))
          return false
        }}
      />
      <button class="settings-step-btn" onClicked={() => step(1)}>
        <label label="+" />
      </button>
    </box>
  )
}

function SelectControl(props: {
  def: SettingDef
  acc: Accessor<unknown>
  setter: (v: unknown) => void
}) {
  const { def, acc, setter } = props
  return (
    <box class="settings-select">
      {(def.options ?? []).map((opt) => (
        <button
          class={createMemo(() =>
            acc() === opt ? "settings-option active" : "settings-option",
          )}
          onClicked={() => setter(opt)}
        >
          <label label={opt} />
        </button>
      ))}
    </box>
  )
}

function SettingControl(props: {
  def: SettingDef
  acc: Accessor<unknown>
  setter: (v: unknown) => void
}) {
  const { def, acc, setter } = props
  if (def.type === "boolean") return BooleanControl({ acc, setter })
  if (def.type === "number") return NumberControl({ def, acc, setter })
  if (def.type === "select") return SelectControl({ def, acc, setter })
  return StringControl({ acc, setter })
}

// ─── Section content ──────────────────────────────────────────────────────────

function SectionContent(props: { section: SettingsSection }) {
  const { section } = props
  const entries = Object.entries(section.schema)

  return (
    <box class="settings-section-body" vertical>
      {entries.map(([key, def]) => {
        const [acc, setter] = section._states[key]
        return (
          <box class="settings-row" vertical>
            <box class="settings-row-header">
              <label class="settings-row-label" label={def.label} xalign={0} hexpand />
              {SettingControl({ def, acc, setter })}
            </box>
            {def.description ? (
              <label
                class="settings-row-desc"
                label={def.description}
                xalign={0}
                wrap
              />
            ) : (
              <box />
            )}
          </box>
        )
      })}
    </box>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function SettingsPanel(visible: Accessor<boolean>, hide: () => void) {
  // Sections are collected after all panel modules have been imported.
  // We snapshot them once at render time — the list is stable after startup.
  const sections = getSettingsRegistrations() as SettingsSection[]

  const [activeSectionId, setActiveSectionId] = createState(
    sections[0]?.id ?? "",
  )

  function onKeyPress(_: Astal.EventBox, event: Gdk.EventKey) {
    if (event.get_keyval()[1] === Gdk.KEY_Escape) hide()
  }

  return (
    <eventbox
      class="settings-backdrop"
      expand
      onKeyPressEvent={(self: Astal.EventBox, event: Gdk.EventKey) => onKeyPress(self, event)}
      onButtonPressEvent={(self: Astal.EventBox, event: Gdk.EventButton) => {
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
        <box class="settings-panel" vertical halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>

          {/* Header */}
          <box class="settings-header">
            <label class="settings-title" label="Settings" xalign={0} hexpand />
            <button class="settings-close-btn" onClicked={hide}>
              <label label="✕" />
            </button>
          </box>

          {/* Body */}
          <box class="settings-body">

            {/* Sidebar */}
            <box class="settings-sidebar" vertical>
              {sections.map((section) => (
                <button
                  class={createMemo(() =>
                    activeSectionId() === section.id
                      ? "settings-sidebar-btn active"
                      : "settings-sidebar-btn",
                  )}
                  onClicked={() => setActiveSectionId(section.id)}
                >
                  <box>
                    <icon icon={section.icon} />
                    <label label={section.label} xalign={0} hexpand />
                  </box>
                </button>
              ))}
            </box>

            {/* Content */}
            <scrollable
              class="settings-content"
              vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
              hscrollbar_policy={Gtk.PolicyType.NEVER}
              vexpand
            >
              <box vertical>
                <label
                  class="settings-section-title"
                  label={createMemo(() => sections.find((s) => s.id === activeSectionId())?.label ?? "")}
                  xalign={0}
                />
                {sections.map((section) => (
                  <box visible={createMemo(() => activeSectionId() === section.id)}>
                    {SectionContent({ section })}
                  </box>
                ))}
              </box>
            </scrollable>

          </box>
        </box>
      </box>
    </eventbox>
  )
}
