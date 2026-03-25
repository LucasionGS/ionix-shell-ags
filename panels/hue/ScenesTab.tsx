import { Gtk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import {
  listScenesAsync,
  fetchSceneCommandsAsync,
  type HueScene,
  type SceneCommand,
} from "./hue-utils"

type SceneCmdType = "color" | "brightness" | "on" | "off"

const CMD_TYPES: { type: SceneCmdType; label: string }[] = [
  { type: "color", label: "Color" },
  { type: "brightness", label: "Brightness" },
  { type: "on", label: "On" },
  { type: "off", label: "Off" },
]

export function ScenesTab(visible: Accessor<boolean>, hide: () => void, isActive: Accessor<boolean>) {
  const [scenes, setScenes] = createState<HueScene[]>([])
  const [expandedScene, setExpandedScene] = createState<string | null>(null)
  const [sceneCommands, setSceneCommands] = createState<SceneCommand[]>([])
  const [creatingScene, setCreatingScene] = createState(false)
  const [newSceneName, setNewSceneName] = createState("")
  const [addingCommand, setAddingCommand] = createState(false)

  // Command builder state
  const [cmdType, setCmdType] = createState<SceneCmdType>("color")
  const [cmdTarget, setCmdTarget] = createState("")
  const [cmdColorR, setCmdColorR] = createState("")
  const [cmdColorG, setCmdColorG] = createState("")
  const [cmdColorB, setCmdColorB] = createState("")
  const [cmdBrightness, setCmdBrightness] = createState("")

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
    listScenesAsync().then(setScenes).catch(() => {})
    // Refresh expanded scene commands too
    const expanded = expandedScene()
    if (expanded) {
      fetchSceneCommandsAsync(expanded).then(setSceneCommands).catch(() => {})
    }
  }

  function expandScene(name: string) {
    if (expandedScene() === name) {
      setExpandedScene(null)
      setAddingCommand(false)
      return
    }
    setExpandedScene(name)
    setAddingCommand(false)
    fetchSceneCommandsAsync(name).then(setSceneCommands).catch(() => setSceneCommands([]))
  }

  function executeScene(name: string) {
    execAsync(["hue", "scene", name]).catch(() => {})
  }

  function deleteScene(name: string) {
    execAsync(["hue", "scene", "remove", name])
      .then(() => {
        if (expandedScene() === name) setExpandedScene(null)
        refresh()
      })
      .catch(() => {})
  }

  function removeCommand(sceneName: string, index: number) {
    execAsync(["hue", "scene", "remove", sceneName, index.toString()])
      .then(() => {
        fetchSceneCommandsAsync(sceneName).then(setSceneCommands)
        listScenesAsync().then(setScenes)
      })
      .catch(() => {})
  }

  function resetCommandBuilder() {
    setCmdType("color")
    setCmdTarget("")
    setCmdColorR("")
    setCmdColorG("")
    setCmdColorB("")
    setCmdBrightness("")
  }

  function startAddCommand() {
    resetCommandBuilder()
    setAddingCommand(true)
  }

  function addCommand() {
    const scene = expandedScene()
    if (!scene || !cmdTarget().trim()) return
    const args = ["hue", "scene", "add", scene, cmdType(), cmdTarget()]
    if (cmdType() === "color") {
      args.push(cmdColorR(), cmdColorG(), cmdColorB())
    } else if (cmdType() === "brightness") {
      args.push(cmdBrightness())
    }
    execAsync(args)
      .then(() => {
        setAddingCommand(false)
        fetchSceneCommandsAsync(scene).then(setSceneCommands)
        listScenesAsync().then(setScenes)
      })
      .catch(() => {})
  }

  function startNewScene() {
    setCreatingScene(true)
    setNewSceneName("")
  }

  function confirmNewScene() {
    const name = newSceneName().trim()
    if (!name) return
    setCreatingScene(false)
    setExpandedScene(name)
    setSceneCommands([])
    startAddCommand()
  }

  return (
    <box vertical>
      <box class="hue-header">
        <label class="hue-title" label="Scenes" xalign={0} hexpand />
        <label class="hue-count" label={scenes((s) => `${s.length}`)} />
        <button class="hue-add-btn" onClicked={() => startNewScene()}>
          <icon icon="list-add-symbolic" />
        </button>
        <button class="hue-refresh-btn" onClicked={() => refresh()}>
          <icon icon="view-refresh-symbolic" />
        </button>
      </box>

      {/* New scene name input */}
      <box class="hue-editor" vertical visible={creatingScene}>
        <box class="hue-editor-header">
          <label label="New Scene" hexpand xalign={0} />
          <button class="hue-editor-close" onClicked={() => setCreatingScene(false)}>
            <icon icon="window-close-symbolic" />
          </button>
        </box>
        <entry
          class="hue-editor-input"
          placeholder_text="Scene name"
          onChanged={(self) => setNewSceneName(self.get_text())}
          onActivate={() => confirmNewScene()}
          $={(self) => {
            if (creatingScene()) self.grab_focus()
          }}
        />
        <button
          class="hue-editor-save"
          onClicked={() => confirmNewScene()}
          sensitive={createMemo(() => newSceneName().trim() !== "")}
        >
          <label label="Create & Add Commands" />
        </button>
      </box>

      {/* Scene list */}
      <scrollable
        class="hue-list-scroll"
        visible={createMemo(() => !creatingScene())}
        vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
        hscrollbar_policy={Gtk.PolicyType.NEVER}
        vexpand
      >
        <box class="hue-list" vertical>
          <For each={scenes} id={(s) => s.name}>
            {(scene) => (
              <box class="hue-scene-card" vertical>
                <box class="hue-scene-header">
                  <button class="hue-scene-expand" onClicked={() => expandScene(scene.name)} hexpand>
                    <box>
                      <icon
                        icon={createMemo(() =>
                          expandedScene() === scene.name
                            ? "pan-down-symbolic"
                            : "pan-end-symbolic"
                        )}
                      />
                      <label class="hue-scene-name" label={scene.name} xalign={0} hexpand />
                      <label class="hue-scene-count" label={`${scene.commandCount} cmd`} />
                    </box>
                  </button>
                  <button class="hue-scene-play" onClicked={() => executeScene(scene.name)}>
                    <icon icon="media-playback-start-symbolic" />
                  </button>
                  <button class="hue-scene-delete" onClicked={() => deleteScene(scene.name)}>
                    <icon icon="edit-delete-symbolic" />
                  </button>
                </box>

                {/* Expanded command list */}
                <box
                  class="hue-scene-commands"
                  vertical
                  visible={createMemo(() => expandedScene() === scene.name)}
                >
                  <For each={sceneCommands} id={(c) => `${c.index}-${c.raw}`}>
                    {(cmd) => (
                      <box class="hue-scene-cmd-item">
                        <label class="hue-scene-cmd-index" label={`${cmd.index}.`} />
                        <label class="hue-scene-cmd-text" label={cmd.raw} xalign={0} hexpand />
                        <button
                          class="hue-scene-cmd-remove"
                          onClicked={() => removeCommand(scene.name, cmd.index)}
                        >
                          <icon icon="list-remove-symbolic" />
                        </button>
                      </box>
                    )}
                  </For>

                  {/* Add command button */}
                  <button
                    class="hue-scene-add-cmd"
                    visible={createMemo(() => !addingCommand())}
                    onClicked={() => startAddCommand()}
                  >
                    <box>
                      <icon icon="list-add-symbolic" />
                      <label label="Add Command" />
                    </box>
                  </button>

                  {/* Command builder */}
                  <box class="hue-cmd-builder" vertical visible={addingCommand}>
                    <box class="hue-cmd-builder-header">
                      <label label="New Command" hexpand xalign={0} />
                      <button onClicked={() => setAddingCommand(false)}>
                        <icon icon="window-close-symbolic" />
                      </button>
                    </box>

                    {/* Type selector */}
                    <box class="hue-cmd-type-bar">
                      {CMD_TYPES.map((t) => (
                        <button
                          class={createMemo(() =>
                            cmdType() === t.type ? "hue-type-btn active" : "hue-type-btn"
                          )}
                          onClicked={() => setCmdType(t.type)}
                        >
                          <label label={t.label} />
                        </button>
                      ))}
                    </box>

                    {/* Target */}
                    <entry
                      class="hue-editor-input"
                      placeholder_text="Target (light name, ID, or g:groupname)"
                      onChanged={(self) => setCmdTarget(self.get_text())}
                    />

                    {/* Color fields */}
                    <box class="hue-cmd-color-fields" visible={createMemo(() => cmdType() === "color")}>
                      <entry
                        class="hue-input-sm"
                        placeholder_text="R"
                        onChanged={(self) => setCmdColorR(self.get_text())}
                      />
                      <entry
                        class="hue-input-sm"
                        placeholder_text="G"
                        onChanged={(self) => setCmdColorG(self.get_text())}
                      />
                      <entry
                        class="hue-input-sm"
                        placeholder_text="B"
                        onChanged={(self) => setCmdColorB(self.get_text())}
                      />
                    </box>

                    {/* Brightness field */}
                    <entry
                      class="hue-editor-input"
                      placeholder_text="Brightness (0-254)"
                      visible={createMemo(() => cmdType() === "brightness")}
                      onChanged={(self) => setCmdBrightness(self.get_text())}
                    />

                    <button
                      class="hue-editor-save"
                      onClicked={() => addCommand()}
                      sensitive={createMemo(() => cmdTarget().trim() !== "")}
                    >
                      <label label="Add" />
                    </button>
                  </box>
                </box>
              </box>
            )}
          </For>
        </box>
      </scrollable>

      <box class="hue-footer">
        <label
          class="hue-footer-hint"
          label={scenes((s) => `${s.length} scene${s.length !== 1 ? "s" : ""}`)}
          xalign={0}
          hexpand
        />
        <label class="hue-footer-keys" label="Tab switch  |  Esc close" />
      </box>
    </box>
  )
}
