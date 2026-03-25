import { Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import {
  listGroupsAsync,
  listLightsAsync,
  fetchGroupLightsAsync,
  gdkColorToHex,
  type HueGroup,
  type HueLight,
} from "./hue-utils"

export function GroupsTab(visible: Accessor<boolean>, hide: () => void, isActive: Accessor<boolean>) {
  const [groups, setGroups] = createState<HueGroup[]>([])
  const [expandedGroup, setExpandedGroup] = createState<string | null>(null)
  const [groupLights, setGroupLights] = createState<string[]>([])
  const [editing, setEditing] = createState(false)
  const [newGroupName, setNewGroupName] = createState("")
  const [allLights, setAllLights] = createState<HueLight[]>([])
  const [selectedLights, setSelectedLights] = createState<string[]>([])
  const [colorTarget, setColorTarget] = createState<string | null>(null)

  let chooserWidget: Gtk.ColorChooserWidget | null = null

  let fetched = false
  const maybeLoad = () => {
    if (visible() && isActive() && !fetched) {
      fetched = true
      refresh()
    }
  }
  visible.subscribe(maybeLoad)
  isActive.subscribe(maybeLoad)

  function refresh() {
    listGroupsAsync().then(setGroups).catch(() => {})
  }

  function expandGroup(name: string) {
    if (expandedGroup() === name) {
      setExpandedGroup(null)
      return
    }
    setExpandedGroup(name)
    fetchGroupLightsAsync(name).then(setGroupLights).catch(() => setGroupLights([]))
  }

  function startEditing() {
    setEditing(true)
    setNewGroupName("")
    setSelectedLights([])
    listLightsAsync().then(setAllLights).catch(() => {})
  }

  function toggleLightSelection(name: string) {
    const current = selectedLights()
    if (current.includes(name)) {
      setSelectedLights(current.filter((l) => l !== name))
    } else {
      setSelectedLights([...current, name])
    }
  }

  function createGroup() {
    const name = newGroupName().trim()
    const selected = selectedLights()
    if (!name || selected.length === 0) return
    execAsync(["hue", "group", "add", name, ...selected])
      .then(() => { setEditing(false); refresh() })
      .catch(() => {})
  }

  function deleteGroup(name: string) {
    execAsync(["hue", "group", "remove", name])
      .then(() => {
        if (expandedGroup() === name) setExpandedGroup(null)
        refresh()
      })
      .catch(() => {})
  }

  function removeLightFromGroup(groupName: string, lightName: string) {
    execAsync(["hue", "group", "remove", groupName, lightName])
      .then(() => fetchGroupLightsAsync(groupName).then(setGroupLights))
      .then(() => refresh())
      .catch(() => {})
  }

  function applyGroupColor() {
    const target = colorTarget()
    if (!target || !chooserWidget) return
    const hex = gdkColorToHex(chooserWidget.get_rgba())
    execAsync(["hue", "color", `g:${target}`, hex])
      .then(() => setColorTarget(null))
      .catch(() => {})
  }

  return (
    <box vertical>
      <box class="hue-header">
        <label class="hue-title" label="Groups" xalign={0} hexpand />
        <label class="hue-count" label={groups((g) => `${g.length}`)} />
        <button class="hue-add-btn" onClicked={() => startEditing()}>
          <icon icon="list-add-symbolic" />
        </button>
        <button class="hue-refresh-btn" onClicked={() => refresh()}>
          <icon icon="view-refresh-symbolic" />
        </button>
      </box>

      {/* Group editor */}
      <box class="hue-editor" vertical visible={editing}>
        <box class="hue-editor-header">
          <label label="New Group" hexpand xalign={0} />
          <button class="hue-editor-close" onClicked={() => setEditing(false)}>
            <icon icon="window-close-symbolic" />
          </button>
        </box>
        <entry
          class="hue-editor-input"
          placeholder_text="Group name"
          onChanged={(self) => setNewGroupName(self.get_text())}
          $={(self) => { if (editing()) self.grab_focus() }}
        />
        <label class="hue-editor-label" label="Select lights:" xalign={0} />
        <scrollable
          class="hue-editor-list-scroll"
          vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
          hscrollbar_policy={Gtk.PolicyType.NEVER}
        >
          <box class="hue-editor-list" vertical>
            <For each={allLights} id={(l) => l.id}>
              {(light) => (
                <button
                  class={createMemo(() =>
                    selectedLights().includes(light.name)
                      ? "hue-select-item selected"
                      : "hue-select-item"
                  )}
                  onClicked={() => toggleLightSelection(light.name)}
                >
                  <box>
                    <label label={light.name} hexpand xalign={0} />
                    <icon
                      icon="emblem-ok-symbolic"
                      visible={createMemo(() => selectedLights().includes(light.name))}
                    />
                  </box>
                </button>
              )}
            </For>
          </box>
        </scrollable>
        <button
          class="hue-editor-save"
          onClicked={() => createGroup()}
          sensitive={createMemo(() => newGroupName().trim() !== "" && selectedLights().length > 0)}
        >
          <label label="Create Group" />
        </button>
      </box>

      {/* Horizontal split: group list on left, color picker on right */}
      <box hexpand vexpand visible={createMemo(() => !editing())}>
        <scrollable
          class="hue-list-scroll"
          vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
          hscrollbar_policy={Gtk.PolicyType.NEVER}
          hexpand
          vexpand
        >
          <box class="hue-list" vertical>
            <For each={groups} id={(g) => g.name}>
              {(group) => (
                <box class="hue-group-card" vertical>
                  <box class="hue-group-header">
                    <button class="hue-group-expand" onClicked={() => expandGroup(group.name)} hexpand>
                      <box>
                        <icon
                          icon={createMemo(() =>
                            expandedGroup() === group.name
                              ? "pan-down-symbolic"
                              : "pan-end-symbolic"
                          )}
                        />
                        <label class="hue-group-name" label={group.name} xalign={0} hexpand />
                        <label class="hue-group-count" label={`${group.lightCount} lights`} />
                      </box>
                    </button>
                    <button class="hue-group-on" onClicked={() => execAsync(["hue", "on", `g:${group.name}`])}>
                      <icon icon="media-playback-start-symbolic" />
                    </button>
                    <button class="hue-group-off" onClicked={() => execAsync(["hue", "off", `g:${group.name}`])}>
                      <icon icon="media-playback-stop-symbolic" />
                    </button>
                    <button class="hue-group-color" onClicked={() => setColorTarget(group.name)}>
                      <icon icon="color-select-symbolic" />
                    </button>
                    <button class="hue-group-delete" onClicked={() => deleteGroup(group.name)}>
                      <icon icon="edit-delete-symbolic" />
                    </button>
                  </box>

                  <box
                    class="hue-group-lights"
                    vertical
                    visible={createMemo(() => expandedGroup() === group.name)}
                  >
                    <For each={groupLights} id={(l) => l}>
                      {(lightName) => (
                        <box class="hue-group-light-item">
                          <label label={lightName} xalign={0} hexpand />
                          <button
                            class="hue-group-light-remove"
                            onClicked={() => removeLightFromGroup(group.name, lightName)}
                          >
                            <icon icon="list-remove-symbolic" />
                          </button>
                        </box>
                      )}
                    </For>
                  </box>
                </box>
              )}
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
              label={createMemo(() => `g:${colorTarget() ?? ""}`)}
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
          <button class="hue-color-apply" onClicked={() => applyGroupColor()}>
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
          label={groups((g) => `${g.length} group${g.length !== 1 ? "s" : ""}`)}
          xalign={0}
          hexpand
        />
        <label class="hue-footer-keys" label="Tab switch  |  Esc close" />
      </box>
    </box>
  )
}
