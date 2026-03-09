import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import {
  listContainers,
  parseContainerOutput,
  formatPorts,
  DOCKER_PS_CMD,
  type DockerContainer,
} from "./docker-utils"

export function DockerPanel(visible: Accessor<boolean>, hide: () => void) {
  const [containers, setContainers] = createState(listContainers())
  const [query, setQuery] = createState("")

  function refresh() {
    execAsync(DOCKER_PS_CMD)
      .then((output) => {
        setContainers(parseContainerOutput(output))
      })
      .catch(() => {})
  }

  visible.subscribe(() => {
    if (visible()) refresh()
  })

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    const all = containers()
    if (q === "") return all
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.project.toLowerCase().includes(q) ||
        c.ports.some(
          (p) => p.hostPort.includes(q) || p.containerPort.includes(q),
        ),
    )
  })

  const runningCount = createMemo(
    () => containers().filter((c) => c.state === "running").length,
  )
  const totalCount = createMemo(() => containers().length)

  function toggleContainer(container: DockerContainer) {
    const action = container.state === "running" ? "stop" : "start"
    execAsync(["docker", action, container.name])
      .then(() => refresh())
      .catch(() => {})
  }

  function openProjectDir(dir: string) {
    execAsync(["kitty", "--directory", dir]).catch(() => {})
    hide()
  }

  function onKeyPress(_: Astal.EventBox | Gtk.Entry, event: Gdk.EventKey) {
    const keyval = event.get_keyval()[1]
    if (keyval === Gdk.KEY_Escape) {
      hide()
    }
  }

  return (
    <eventbox
      onKeyPressEvent={onKeyPress}
      onButtonPressEvent={(self, event) => {
        const [, x] = event.get_coords()
        const backdrop = self.get_children()[0] as Gtk.Box
        if (backdrop) {
          const panel = backdrop.get_children()[0]
          if (panel) {
            const alloc = panel.get_allocation()
            if (x > alloc.x + alloc.width) {
              hide()
            }
          }
        }
      }}
    >
      <box class="docker-backdrop">
        <box class="docker-panel" vertical>
          <box class="docker-header">
            <label class="docker-title" label="Docker" xalign={0} hexpand />
            <label
              class="docker-count"
              label={createMemo(
                () => `${runningCount()}/${totalCount()}`,
              )}
            />
            <button class="docker-refresh-btn" onClicked={() => refresh()}>
              <icon icon="view-refresh-symbolic" />
            </button>
          </box>

          <entry
            class="docker-search"
            placeholder_text="Filter containers..."
            onChanged={(self) => setQuery(self.get_text())}
            $={(self) => {
              visible.subscribe(() => {
                if (visible()) {
                  self.set_text("")
                  setQuery("")
                  self.grab_focus()
                }
              })
            }}
            onKeyPressEvent={onKeyPress}
          />

          <scrollable
            class="docker-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="docker-list" vertical>
              <For
                each={filtered}
                id={(c) => `${c.id}-${c.state}`}
              >
                {(container) => {
                  const isRunning = container.state === "running"
                  const ports = formatPorts(container.ports)

                  return (
                    <box
                      class={
                        isRunning
                          ? "docker-item running"
                          : "docker-item stopped"
                      }
                      vertical
                    >
                      <box class="docker-item-header">
                        <label
                          class={
                            isRunning
                              ? "docker-state-dot running"
                              : "docker-state-dot stopped"
                          }
                          label={"\u25CF"}
                        />
                        <label
                          class="docker-item-name"
                          label={container.name}
                          xalign={0}
                          hexpand
                        />
                        <button
                          class="docker-copy-id"
                          tooltip_text={container.id}
                          onClicked={() =>
                            execAsync(["wl-copy", container.id])
                          }
                        >
                          <icon icon="edit-copy-symbolic" />
                        </button>
                        <button
                          class="docker-open-dir"
                          tooltip_text={container.projectDir}
                          visible={container.projectDir !== ""}
                          onClicked={() =>
                            openProjectDir(container.projectDir)
                          }
                        >
                          <icon icon="folder-symbolic" />
                        </button>
                        <button
                          class={
                            isRunning
                              ? "docker-toggle-btn stop"
                              : "docker-toggle-btn start"
                          }
                          onClicked={() => toggleContainer(container)}
                        >
                          <icon
                            icon={
                              isRunning
                                ? "media-playback-stop-symbolic"
                                : "media-playback-start-symbolic"
                            }
                          />
                        </button>
                      </box>

                      <label
                        class="docker-item-image"
                        label={container.image}
                        xalign={0}
                      />
                      <label
                        class="docker-item-status"
                        label={container.status}
                        xalign={0}
                      />

                      <label
                        class="docker-item-project"
                        label={container.project}
                        xalign={0}
                        visible={container.project !== ""}
                      />

                      <label
                        class="docker-item-ports"
                        label={ports}
                        xalign={0}
                        visible={ports !== ""}
                      />
                    </box>
                  )
                }}
              </For>
            </box>
          </scrollable>

          <box class="docker-footer">
            <label
              class="docker-footer-count"
              label={filtered(
                (f) =>
                  `${f.length} container${f.length !== 1 ? "s" : ""}`,
              )}
              xalign={0}
              hexpand
            />
            <label
              class="docker-footer-keys"
              label="Esc close"
            />
          </box>
        </box>
        <box hexpand />
      </box>
    </eventbox>
  )
}
