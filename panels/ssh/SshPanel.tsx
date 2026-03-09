import { Astal, Gtk, Gdk } from "ags/gtk3"
import { execAsync } from "ags/process"
import { type Accessor, createState, createMemo, For } from "gnim"
import { parseSshConfig, type SshHost } from "./parse-ssh-config"

export function SshPanel(visible: Accessor<boolean>, hide: () => void) {
  const hosts = parseSshConfig()
  const [query, setQuery] = createState("")
  const [selectedIndex, setSelectedIndex] = createState(0)

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    if (q === "") return hosts
    return hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.hostname.toLowerCase().includes(q) ||
        h.user.toLowerCase().includes(q) ||
        (h.group?.toLowerCase().includes(q) ?? false),
    )
  })

  let connectionStarted = false;
  function connect(host: SshHost) {
    if (connectionStarted) {
      return;
    }
    connectionStarted = true;
    setTimeout(() => {
      connectionStarted = false;
    }, 1000);
    hide()
    execAsync(["kitty", "kitten", "ssh", host.name])
  }

  let unbounce = false;

  function onKeyPress(source: Astal.EventBox | Gtk.Entry, event: Gdk.EventKey, preventDouble = false) {
    const keyval = event.get_keyval()[1] // This works, ignore the error
    
    if (unbounce) {
      return;
    }

    unbounce = true;
    setTimeout(() => {
      unbounce = false;
    }, 0);
    
    if (keyval === Gdk.KEY_Escape) {
      hide()
      return
    }

    // if (preventDouble) {
    //   return;
    // }

    if (keyval === Gdk.KEY_Return) {
      const results = filtered()
      const idx = selectedIndex()
      if (results.length > 0 && idx < results.length) {
        connect(results[idx])
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

  return (
    <eventbox
      onKeyPressEvent={(self, event) => onKeyPress(self, event)}
      onButtonPressEvent={(self, event) => {
        // Close on click outside the card
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
      <box class="ssh-panel-backdrop" halign={Gtk.Align.FILL} valign={Gtk.Align.FILL}>
        <box
          class="ssh-panel"
          vertical
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          hexpand
          vexpand
        >
          <box class="ssh-header" vertical>
            <label class="ssh-title" label="SSH Connections" xalign={0} />
            <entry
              class="ssh-search"
              placeholder_text="Search hosts..."
              onChanged={(self) => {
                setQuery(self.get_text())
                setSelectedIndex(0)
              }}
              $={(self) => {
                // Auto-focus and reset when panel becomes visible
                visible.subscribe(() => {
                  if (visible()) {
                    self.set_text("")
                    setQuery("")
                    setSelectedIndex(0)
                    self.grab_focus()
                  }
                })
              }}
              onKeyPressEvent={(self, event) => onKeyPress(self, event, true)}
            />
          </box>

          <scrollable
            class="ssh-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="ssh-list" vertical>
              <For each={filtered} id={(host) => host.name}>
                {(host, index) => {
                  const itemClass = createMemo(() =>
                    index() === selectedIndex() ? "ssh-item selected" : "ssh-item"
                  )
                  return (
                    <button
                      class={itemClass}
                      onClicked={() => connect(host)}
                    >
                      <box vertical>
                        <box>
                          <icon
                            class="ssh-item-icon"
                            icon="network-server-symbolic"
                          />
                          <label class="ssh-item-name" label={host.name} xalign={0} hexpand />
                          {host.group && (
                            <label class="ssh-item-group" label={host.group} />
                          )}
                        </box>
                        <box class="ssh-item-details">
                          <label
                            class="ssh-item-user"
                            label={`${host.user}@${host.hostname}`}
                            xalign={0}
                          />
                          {host.port && host.port !== 22 && (
                            <label class="ssh-item-port" label={`:${host.port}`} />
                          )}
                          {host.proxyJump && (
                            <label class="ssh-item-jump" label={`via ${host.proxyJump}`} />
                          )}
                        </box>
                      </box>
                    </button>
                  )
                }}
              </For>
            </box>
          </scrollable>

          <box class="ssh-footer">
            <label
              class="ssh-footer-hint"
              label={filtered((f) => `${f.length} connection${f.length !== 1 ? "s" : ""}`)}
              xalign={0}
              hexpand
            />
            <label class="ssh-footer-keys" label="Up/Down to navigate  |  Enter to connect  |  Esc to close" />
          </box>
        </box>
      </box>
    </eventbox>
  )
}
