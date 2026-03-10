import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo, For } from "gnim"
import GLib from "gi://GLib"
import { loadRules, saveRules } from "./rule-store"
import { getEngine } from "./engine"
import type { AutomationRule, Trigger, Action, TriggerType } from "./types"

type ActionType = Action["type"]

const TRIGGER_TYPES: { type: TriggerType; label: string }[] = [
  { type: "workspace-change", label: "Workspace" },
  { type: "power-state", label: "Power" },
  { type: "wifi-network", label: "WiFi" },
  { type: "time-based", label: "Time" },
  { type: "window-opened", label: "Window" },
  { type: "custom-command", label: "Command" },
]

const ACTION_TYPES: { type: ActionType; label: string }[] = [
  { type: "shell-command", label: "Shell" },
  { type: "docker-toggle", label: "Docker" },
  { type: "vpn-connect", label: "VPN On" },
  { type: "vpn-disconnect", label: "VPN Off" },
  { type: "hyprland-dispatch", label: "Hyprland" },
  { type: "notification", label: "Notify" },
]

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

function describeAction(a: Action): string {
  switch (a.type) {
    case "shell-command":
      return `Shell: ${a.command}`
    case "docker-toggle":
      return `Docker ${a.action} ${a.container}`
    case "vpn-connect":
      return `VPN: ${a.name}`
    case "vpn-disconnect":
      return "VPN disconnect"
    case "hyprland-dispatch":
      return `Hypr: ${a.dispatcher} ${a.arg}`
    case "notification":
      return `Notify: ${a.summary}`
  }
}

function RuleEditor(props: {
  onSave: (rule: AutomationRule) => void
  onCancel: () => void
}) {
  const [name, setName] = createState("")
  const [triggerType, setTriggerType] = createState<TriggerType>("workspace-change")
  const [actionType, setActionType] = createState<ActionType>("shell-command")
  const [actions, setActions] = createState<Action[]>([])

  // Trigger fields
  const [workspace, setWorkspace] = createState("")
  const [powerState, setPowerState] = createState<"plugged" | "unplugged">("unplugged")
  const [ssid, setSsid] = createState("")
  const [hour, setHour] = createState("")
  const [minute, setMinute] = createState("")
  const [days, setDays] = createState("")
  const [windowClass, setWindowClass] = createState("")
  const [cmd, setCmd] = createState("")
  const [expected, setExpected] = createState("")

  // Action fields
  const [actionCmd, setActionCmd] = createState("")
  const [container, setContainer] = createState("")
  const [dockerAction, setDockerAction] = createState<"start" | "stop">("start")
  const [vpnName, setVpnName] = createState("")
  const [dispatcher, setDispatcher] = createState("")
  const [dispArg, setDispArg] = createState("")
  const [notifSummary, setNotifSummary] = createState("")
  const [notifBody, setNotifBody] = createState("")

  function buildTrigger(): Trigger | null {
    switch (triggerType()) {
      case "workspace-change":
        return workspace() ? { type: "workspace-change", workspaceName: workspace() } : null
      case "power-state":
        return { type: "power-state", state: powerState() }
      case "wifi-network":
        return ssid() ? { type: "wifi-network", ssid: ssid() } : null
      case "time-based": {
        const h = parseInt(hour())
        const m = parseInt(minute())
        if (isNaN(h) || isNaN(m)) return null
        const d = days().trim()
        const trigger: Trigger = { type: "time-based", hour: h, minute: m }
        if (d) (trigger as any).days = d.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
        return trigger
      }
      case "window-opened":
        return windowClass() ? { type: "window-opened", windowClass: windowClass() } : null
      case "custom-command":
        return cmd() ? { type: "custom-command", command: cmd(), expectedOutput: expected() } : null
    }
  }

  function buildAction(): Action | null {
    switch (actionType()) {
      case "shell-command":
        return actionCmd() ? { type: "shell-command", command: actionCmd() } : null
      case "docker-toggle":
        return container() ? { type: "docker-toggle", container: container(), action: dockerAction() } : null
      case "vpn-connect":
        return vpnName() ? { type: "vpn-connect", name: vpnName() } : null
      case "vpn-disconnect":
        return { type: "vpn-disconnect" }
      case "hyprland-dispatch":
        return dispatcher() ? { type: "hyprland-dispatch", dispatcher: dispatcher(), arg: dispArg() } : null
      case "notification":
        return notifSummary() ? { type: "notification", summary: notifSummary(), body: notifBody() } : null
    }
  }

  function addAction() {
    const action = buildAction()
    if (!action) return
    setActions([...actions(), action])
    setActionCmd("")
    setContainer("")
    setVpnName("")
    setDispatcher("")
    setDispArg("")
    setNotifSummary("")
    setNotifBody("")
  }

  function removeAction(idx: number) {
    setActions(actions().filter((_, i) => i !== idx))
  }

  function save() {
    const n = name().trim()
    if (!n) return
    const trigger = buildTrigger()
    if (!trigger) return
    const allActions = actions()
    if (allActions.length === 0) return

    const rule: AutomationRule = {
      id: GLib.uuid_string_random(),
      name: n,
      trigger,
      actions: allActions,
      enabled: true,
    }
    props.onSave(rule)
  }

  function TriggerFields() {
    return (
      <box vertical class="auto-editor-fields">
        {/* workspace-change */}
        <entry
          class="auto-editor-input"
          placeholder_text="Workspace name"
          visible={createMemo(() => triggerType() === "workspace-change")}
          onChanged={(self) => setWorkspace(self.get_text())}
        />
        {/* power-state */}
        <box visible={createMemo(() => triggerType() === "power-state")}>
          <button
            class={createMemo(() => powerState() === "unplugged" ? "auto-type-btn active" : "auto-type-btn")}
            onClicked={() => setPowerState("unplugged")}
          >
            <label label="Unplugged" />
          </button>
          <button
            class={createMemo(() => powerState() === "plugged" ? "auto-type-btn active" : "auto-type-btn")}
            onClicked={() => setPowerState("plugged")}
          >
            <label label="Plugged" />
          </button>
        </box>
        {/* wifi-network */}
        <entry
          class="auto-editor-input"
          placeholder_text="SSID"
          visible={createMemo(() => triggerType() === "wifi-network")}
          onChanged={(self) => setSsid(self.get_text())}
        />
        {/* time-based */}
        <box visible={createMemo(() => triggerType() === "time-based")}>
          <entry
            class="auto-editor-input auto-editor-input-sm"
            placeholder_text="HH"
            onChanged={(self) => setHour(self.get_text())}
          />
          <label class="auto-editor-sep" label=":" />
          <entry
            class="auto-editor-input auto-editor-input-sm"
            placeholder_text="MM"
            onChanged={(self) => setMinute(self.get_text())}
          />
          <entry
            class="auto-editor-input"
            placeholder_text="Days (0-6, comma-sep)"
            hexpand
            onChanged={(self) => setDays(self.get_text())}
          />
        </box>
        {/* window-opened */}
        <entry
          class="auto-editor-input"
          placeholder_text="Window class"
          visible={createMemo(() => triggerType() === "window-opened")}
          onChanged={(self) => setWindowClass(self.get_text())}
        />
        {/* custom-command */}
        <box vertical visible={createMemo(() => triggerType() === "custom-command")}>
          <entry
            class="auto-editor-input"
            placeholder_text="Command"
            onChanged={(self) => setCmd(self.get_text())}
          />
          <entry
            class="auto-editor-input"
            placeholder_text="Expected output"
            onChanged={(self) => setExpected(self.get_text())}
          />
        </box>
      </box>
    )
  }

  function ActionFields() {
    return (
      <box vertical class="auto-editor-fields">
        {/* shell-command */}
        <entry
          class="auto-editor-input"
          placeholder_text="Shell command"
          visible={createMemo(() => actionType() === "shell-command")}
          onChanged={(self) => setActionCmd(self.get_text())}
          onActivate={addAction}
        />
        {/* docker-toggle */}
        <box vertical visible={createMemo(() => actionType() === "docker-toggle")}>
          <entry
            class="auto-editor-input"
            placeholder_text="Container name"
            onChanged={(self) => setContainer(self.get_text())}
          />
          <box>
            <button
              class={createMemo(() => dockerAction() === "start" ? "auto-type-btn active" : "auto-type-btn")}
              onClicked={() => setDockerAction("start")}
            >
              <label label="Start" />
            </button>
            <button
              class={createMemo(() => dockerAction() === "stop" ? "auto-type-btn active" : "auto-type-btn")}
              onClicked={() => setDockerAction("stop")}
            >
              <label label="Stop" />
            </button>
          </box>
        </box>
        {/* vpn-connect */}
        <entry
          class="auto-editor-input"
          placeholder_text="VPN name"
          visible={createMemo(() => actionType() === "vpn-connect")}
          onChanged={(self) => setVpnName(self.get_text())}
          onActivate={addAction}
        />
        {/* vpn-disconnect: no fields needed */}
        {/* hyprland-dispatch */}
        <box visible={createMemo(() => actionType() === "hyprland-dispatch")}>
          <entry
            class="auto-editor-input"
            placeholder_text="Dispatcher"
            onChanged={(self) => setDispatcher(self.get_text())}
          />
          <entry
            class="auto-editor-input"
            placeholder_text="Argument"
            hexpand
            onChanged={(self) => setDispArg(self.get_text())}
            onActivate={addAction}
          />
        </box>
        {/* notification */}
        <box vertical visible={createMemo(() => actionType() === "notification")}>
          <entry
            class="auto-editor-input"
            placeholder_text="Summary"
            onChanged={(self) => setNotifSummary(self.get_text())}
          />
          <entry
            class="auto-editor-input"
            placeholder_text="Body"
            onChanged={(self) => setNotifBody(self.get_text())}
            onActivate={addAction}
          />
        </box>
      </box>
    )
  }

  const actionItems = createMemo(() => actions().map((a, i) => ({ action: a, idx: i })))

  return (
    <box class="auto-editor" vertical>
      <box class="auto-editor-header">
        <label class="auto-editor-title" label="New Rule" xalign={0} hexpand />
        <button class="auto-editor-cancel" onClicked={props.onCancel}>
          <label label="Cancel" />
        </button>
      </box>

      <entry
        class="auto-editor-input auto-editor-name"
        placeholder_text="Rule name"
        onChanged={(self) => setName(self.get_text())}
      />

      <box class="auto-editor-section" vertical>
        <label class="auto-editor-section-label" label="Trigger" xalign={0} />
        <box class="auto-editor-type-bar">
          {TRIGGER_TYPES.map((t) => (
            <button
              class={createMemo(() =>
                triggerType() === t.type ? "auto-type-btn active" : "auto-type-btn",
              )}
              onClicked={() => setTriggerType(t.type)}
            >
              <label label={t.label} />
            </button>
          ))}
        </box>
        {TriggerFields()}
      </box>

      <box class="auto-editor-section" vertical>
        <label class="auto-editor-section-label" label="Actions" xalign={0} />

        <box class="auto-editor-actions-list" vertical visible={createMemo(() => actions().length > 0)}>
          <For each={actionItems} id={(item) => `${item.idx}-${item.action.type}`}>
            {(item) => (
              <box class="auto-editor-action-chip">
                <label
                  class="auto-editor-chip-text"
                  label={describeAction(item.action)}
                  xalign={0}
                  hexpand
                  truncate
                />
                <button
                  class="auto-editor-chip-remove"
                  onClicked={() => removeAction(item.idx)}
                >
                  <label label="\u00d7" />
                </button>
              </box>
            )}
          </For>
        </box>

        <box class="auto-editor-type-bar">
          {ACTION_TYPES.map((a) => (
            <button
              class={createMemo(() =>
                actionType() === a.type ? "auto-type-btn active" : "auto-type-btn",
              )}
              onClicked={() => setActionType(a.type)}
            >
              <label label={a.label} />
            </button>
          ))}
        </box>
        {ActionFields()}
        <button class="auto-editor-add-action" onClicked={addAction}>
          <label label="+ Add Action" />
        </button>
      </box>

      <button class="auto-editor-save" onClicked={save}>
        <label label="Save Rule" />
      </button>
    </box>
  )
}

export function AutomationPanel(
  visible: Accessor<boolean>,
  hide: () => void,
) {
  const [rules, setRules] = createState(loadRules())
  const [editing, setEditing] = createState(false)

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

  function addRule(rule: AutomationRule) {
    const updated = [...rules(), rule]
    setRules(updated)
    saveRules(updated)
    getEngine().reload()
    setEditing(false)
  }

  function onKeyPress(
    _: Astal.EventBox | Gtk.Entry,
    event: Gdk.EventKey,
  ) {
    const keyval = event.get_keyval()[1]
    if (keyval === Gdk.KEY_Escape) {
      if (editing()) {
        setEditing(false)
      } else {
        hide()
      }
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
            <button
              class="auto-add-btn"
              onClicked={() => setEditing(!editing())}
              visible={createMemo(() => !editing())}
            >
              <icon icon="list-add-symbolic" />
            </button>
          </box>

          <scrollable
            class="auto-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="auto-list" vertical>
              <box visible={editing}>
                {RuleEditor({
                  onSave: addRule,
                  onCancel: () => setEditing(false),
                })}
              </box>

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
                label="No automation rules defined.\nClick + to add a rule."
                xalign={0.5}
                yalign={0.5}
                justify={Gtk.Justification.CENTER}
                visible={createMemo(() => rules().length === 0 && !editing())}
                vexpand
              />
            </box>
          </scrollable>

          <box class="auto-footer">
            <label
              class="auto-footer-hint"
              label="Rules in ~/.config/ionix-shell/automations.json"
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
