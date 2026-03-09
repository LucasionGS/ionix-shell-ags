import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo, For } from "gnim"
import { loadRules, saveRules } from "./rule-store"
import { getEngine } from "./engine"
import type { AutomationRule, Trigger, Action } from "./types"

function describeTrigger(t: Trigger): string {
  switch (t.type) {
    case "workspace-change":
      return `Workspace \u2192 ${t.workspaceName}`
    case "power-state":
      return `Power ${t.state}`
    case "wifi-network":
      return `WiFi: ${t.ssid}`
    case "time-based": {
      const time = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
      return t.days ? `At ${time} (days: ${t.days.join(",")})` : `At ${time}`
    }
    case "window-opened":
      return `Window: ${t.windowClass}`
    case "custom-command":
      return `Cmd: ${t.command}`
  }
}

function describeActions(actions: Action[]): string {
  return actions
    .map((a) => {
      switch (a.type) {
        case "shell-command":
          return a.command
        case "docker-toggle":
          return `docker ${a.action} ${a.container}`
        case "vpn-connect":
          return `VPN connect ${a.name}`
        case "vpn-disconnect":
          return "VPN disconnect"
        case "hyprland-dispatch":
          return `${a.dispatcher} ${a.arg}`
        case "notification":
          return `Notify: ${a.summary}`
      }
    })
    .join(" \u2192 ")
}

export function AutomationPanel(
  visible: Accessor<boolean>,
  hide: () => void,
) {
  const [rules, setRules] = createState(loadRules())

  visible.subscribe(() => {
    if (visible()) setRules(loadRules())
  })

  function toggleRule(ruleId: string) {
    const updated = rules().map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r,
    )
    setRules(updated)
    saveRules(updated)
    getEngine().reload()
  }

  function deleteRule(ruleId: string) {
    const updated = rules().filter((r) => r.id !== ruleId)
    setRules(updated)
    saveRules(updated)
    getEngine().reload()
  }

  function onKeyPress(
    _: Astal.EventBox | Gtk.Entry,
    event: Gdk.EventKey,
  ) {
    const keyval = event.get_keyval()[1]
    if (keyval === Gdk.KEY_Escape) {
      hide()
    }
  }

  const enabledCount = createMemo(
    () => rules().filter((r) => r.enabled).length,
  )
  const totalCount = createMemo(() => rules().length)

  return (
    <eventbox
      onKeyPressEvent={onKeyPress}
      onButtonPressEvent={(self, event) => {
        const [, x] = event.get_coords()
        const backdrop = self.get_children()[0] as Gtk.Box
        if (backdrop) {
          const children = backdrop.get_children()
          const panel = children[children.length - 1]
          if (panel) {
            const alloc = panel.get_allocation()
            if (x < alloc.x) {
              hide()
            }
          }
        }
      }}
    >
      <box class="auto-backdrop">
        <box hexpand />
        <box class="auto-panel" vertical>
          <box class="auto-header">
            <label
              class="auto-title"
              label="Automations"
              xalign={0}
              hexpand
            />
            <label
              class="auto-count"
              label={createMemo(
                () => `${enabledCount()}/${totalCount()}`,
              )}
            />
          </box>

          <scrollable
            class="auto-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="auto-list" vertical>
              <For each={rules} id={(r) => r.id}>
                {(rule) => (
                  <box
                    class={
                      rule.enabled
                        ? "auto-rule enabled"
                        : "auto-rule disabled"
                    }
                    vertical
                  >
                    <box class="auto-rule-header">
                      <label
                        class="auto-rule-name"
                        label={rule.name}
                        xalign={0}
                        hexpand
                      />
                      <button
                        class={
                          rule.enabled
                            ? "auto-toggle-btn on"
                            : "auto-toggle-btn off"
                        }
                        onClicked={() => toggleRule(rule.id)}
                      >
                        <label
                          label={rule.enabled ? "ON" : "OFF"}
                        />
                      </button>
                      <button
                        class="auto-delete-btn"
                        onClicked={() => deleteRule(rule.id)}
                      >
                        <icon icon="edit-delete-symbolic" />
                      </button>
                    </box>

                    <box class="auto-rule-trigger">
                      <label
                        class="auto-rule-label"
                        label="IF"
                      />
                      <label
                        class="auto-rule-value"
                        label={describeTrigger(rule.trigger)}
                        xalign={0}
                        hexpand
                      />
                    </box>

                    <box class="auto-rule-action">
                      <label
                        class="auto-rule-label"
                        label="THEN"
                      />
                      <label
                        class="auto-rule-value"
                        label={describeActions(rule.actions)}
                        xalign={0}
                        hexpand
                        wrap
                      />
                    </box>

                    <label
                      class="auto-rule-last"
                      label={
                        rule.lastTriggered
                          ? `Last: ${rule.lastTriggered}`
                          : "Never triggered"
                      }
                      xalign={0}
                      visible={rule.lastTriggered !== undefined}
                    />
                  </box>
                )}
              </For>

              <label
                class="auto-empty"
                label="No automation rules defined.\nEdit ~/.config/ion-ags/automations.json to add rules."
                xalign={0.5}
                yalign={0.5}
                justify={Gtk.Justification.CENTER}
                visible={createMemo(() => rules().length === 0)}
                vexpand
              />
            </box>
          </scrollable>

          <box class="auto-footer">
            <label
              class="auto-footer-hint"
              label="Rules in ~/.config/ion-ags/automations.json"
              xalign={0}
              hexpand
            />
            <label class="auto-footer-keys" label="Esc close" />
          </box>
        </box>
      </box>
    </eventbox>
  )
}
