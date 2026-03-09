import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo, For } from "gnim"
import { fuzzyScore } from "./fuzzy"
import type { CommandResult, CommandProvider } from "./providers/types"
import { CATEGORY_LABELS } from "./providers/types"
import { systemProvider } from "./providers/system-provider"
import { appsProvider } from "./providers/apps-provider"
import { sshProvider } from "./providers/ssh-provider"
import { vpnProvider } from "./providers/vpn-provider"
import { dockerProvider } from "./providers/docker-provider"
import { keybindsProvider } from "./providers/keybinds-provider"
import { windowsProvider } from "./providers/windows-provider"
import { scriptsProvider } from "./providers/scripts-provider"
import { zoxideProvider } from "./providers/zoxide-provider"

const SYNC_PROVIDERS: CommandProvider[] = [
  systemProvider,
  appsProvider,
  sshProvider,
  vpnProvider,
  scriptsProvider,
]

const ASYNC_PROVIDERS: CommandProvider[] = [
  windowsProvider,
  keybindsProvider,
  dockerProvider,
  zoxideProvider,
]

async function gatherResults(): Promise<CommandResult[]> {
  const syncResults = SYNC_PROVIDERS.flatMap((p) => {
    try {
      return p.fetch() as CommandResult[]
    } catch {
      return []
    }
  })

  const asyncPromises = ASYNC_PROVIDERS.map((p) =>
    Promise.resolve(p.fetch()).catch(() => [] as CommandResult[]),
  )

  const asyncResults = await Promise.all(asyncPromises)
  return [...syncResults, ...asyncResults.flat()]
}

export function CommandPalette(
  visible: Accessor<boolean>,
  hide: () => void,
) {
  const [allResults, setAllResults] = createState<CommandResult[]>([])
  const [query, setQuery] = createState("")
  const [selectedIndex, setSelectedIndex] = createState(0)

  visible.subscribe(() => {
    if (visible()) {
      gatherResults().then((results) => setAllResults(results))
    }
  })

  const filtered = createMemo(() => {
    const q = query().toLowerCase()
    const all = allResults()
    if (q === "") return all.slice(0, 50)
    return all
      .map((r) => ({ result: r, score: fuzzyScore(q, r.keywords) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((r) => r.result)
  })

  let executionGuard = false
  function executeSelected() {
    if (executionGuard) return
    const results = filtered()
    const idx = selectedIndex()
    if (results.length > 0 && idx < results.length) {
      executionGuard = true
      setTimeout(() => {
        executionGuard = false
      }, 1000)
      hide()
      results[idx].execute()
    }
  }

  let unbounce = false
  function onKeyPress(
    _: Astal.EventBox | Gtk.Entry,
    event: Gdk.EventKey,
  ) {
    const keyval = event.get_keyval()[1]

    if (unbounce) return
    unbounce = true
    setTimeout(() => {
      unbounce = false
    }, 0)

    if (keyval === Gdk.KEY_Escape) {
      hide()
      return
    }

    if (keyval === Gdk.KEY_Return) {
      executeSelected()
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
      <box
        class="cmd-backdrop"
        halign={Gtk.Align.FILL}
        valign={Gtk.Align.FILL}
      >
        <box
          class="cmd-panel"
          vertical
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.START}
          hexpand
          vexpand
        >
          <entry
            class="cmd-search"
            placeholder_text="Type a command..."
            onChanged={(self) => {
              setQuery(self.get_text())
              setSelectedIndex(0)
            }}
            $={(self) => {
              visible.subscribe(() => {
                if (visible()) {
                  self.set_text("")
                  setQuery("")
                  setSelectedIndex(0)
                  setAllResults([])
                  self.grab_focus()
                }
              })
            }}
            onKeyPressEvent={(self, event) => onKeyPress(self, event)}
          />

          <scrollable
            class="cmd-list-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="cmd-list" vertical>
              <For each={filtered} id={(r) => r.id}>
                {(result, index) => {
                  const itemClass = createMemo(() =>
                    index() === selectedIndex()
                      ? "cmd-item selected"
                      : "cmd-item",
                  )

                  const showCategoryHeader = createMemo(() => {
                    const idx = index()
                    if (idx === 0) return true
                    const items = filtered()
                    return (
                      idx > 0 &&
                      items[idx - 1]?.category !== result.category
                    )
                  })

                  return (
                    <box vertical>
                      <label
                        class="cmd-category-header"
                        label={
                          CATEGORY_LABELS[result.category] ??
                          result.category
                        }
                        xalign={0}
                        visible={showCategoryHeader}
                      />
                      <button
                        class={itemClass}
                        onClicked={() => {
                          hide()
                          result.execute()
                        }}
                      >
                        <box>
                          <icon
                            class="cmd-item-icon"
                            icon={result.icon}
                          />
                          <box vertical hexpand>
                            <label
                              class="cmd-item-name"
                              label={result.name}
                              xalign={0}
                              truncate
                            />
                            <label
                              class="cmd-item-desc"
                              label={result.description}
                              xalign={0}
                              truncate
                              visible={result.description !== ""}
                            />
                          </box>
                        </box>
                      </button>
                    </box>
                  )
                }}
              </For>
            </box>
          </scrollable>

          <box class="cmd-footer">
            <label
              class="cmd-footer-count"
              label={filtered(
                (f) =>
                  `${f.length} result${f.length !== 1 ? "s" : ""}`,
              )}
              xalign={0}
              hexpand
            />
            <label
              class="cmd-footer-keys"
              label="Up/Down navigate  |  Enter execute  |  Esc close"
            />
          </box>
        </box>
      </box>
    </eventbox>
  )
}
