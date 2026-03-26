import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor, createState, createMemo, For } from "gnim"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import {
  searchPosts,
  loadPixbuf,
  downloadImage,
  type BooruPost,
} from "./booru-api"
import { registerSettings } from "../settings/settings-store"

const booruSettings = registerSettings(
  "booru",
  "Booru",
  "image-x-generic-symbolic",
  {
    defaultTags: {
      type: "string" as const,
      label: "Default Tags",
      description: "Tags pre-filled when the panel opens",
      default: "",
    },
    defaultRating: {
      type: "select" as const,
      label: "Default Rating",
      default: "safe",
      options: ["safe", "questionable", "explicit", "all"],
    },
    downloadDir: {
      type: "string" as const,
      label: "Download Directory",
      description: "Where downloaded images are saved",
      default: `${GLib.get_home_dir()}/Pictures/Booru`,
    },
  },
)

const RATINGS = [
  { label: "Safe", tag: "rating:safe" },
  { label: "Questionable", tag: "rating:questionable" },
  { label: "Explicit", tag: "rating:explicit" },
  { label: "All", tag: "" },
]

const CARD_WIDTH = 220

function BooruCard(post: BooruPost) {
  const [pixbuf, setPixbuf] = createState<GdkPixbuf.Pixbuf | null>(null)
  const [downloaded, setDownloaded] = createState(false)
  const [downloading, setDownloading] = createState(false)

  loadPixbuf(post.sample_url, CARD_WIDTH).then((pb) => {
    if (pb) setPixbuf(pb)
  })

  function doDownload() {
    if (downloading() || downloaded()) return
    setDownloading(true)
    downloadImage(post, booruSettings.get.downloadDir()).then((ok) => {
      setDownloading(false)
      if (ok) setDownloaded(true)
    })
  }

  const aspectHeight = createMemo(() => {
    const pb = pixbuf()
    if (!pb) return 150
    return Math.round((pb.get_height() / pb.get_width()) * CARD_WIDTH)
  })

  return (
    <box class="booru-card" vertical>
      <box
        class="booru-card-image"
        css={createMemo(
          () => `min-height: ${aspectHeight()}px; min-width: ${CARD_WIDTH}px;`,
        )}
      >
        <label
          class="booru-card-loading"
          label="Loading..."
          hexpand
          visible={createMemo(() => pixbuf() === null)}
        />
        <Gtk.Image
          visible={createMemo(() => pixbuf() !== null)}
          $={(self) => {
            pixbuf.subscribe(() => {
              const pb = pixbuf()
              if (pb) self.set_from_pixbuf(pb)
            })
          }}
        />
      </box>
      <box class="booru-card-info">
        <label
          class="booru-card-score"
          label={`\u2605 ${post.score}`}
          xalign={0}
        />
        <label
          class="booru-card-dims"
          label={`${post.width}\u00d7${post.height}`}
          xalign={0}
          hexpand
        />
        <button
          class={createMemo(() =>
            downloaded() ? "booru-download-btn done" : "booru-download-btn",
          )}
          tooltip_text="Download original"
          onClicked={doDownload}
        >
          <icon
            icon={createMemo(() =>
              downloaded()
                ? "emblem-ok-symbolic"
                : downloading()
                  ? "content-loading-symbolic"
                  : "document-save-symbolic",
            )}
          />
        </button>
      </box>
      <label
        class="booru-card-tags"
        label={post.tags.split(" ").slice(0, 6).join(", ")}
        xalign={0}
        wrap
        max_width_chars={30}
      />
    </box>
  )
}

export function BooruPanel(visible: Accessor<boolean>, hide: () => void) {
  const [posts, setPosts] = createState<BooruPost[]>([])
  const [query, setQuery] = createState(booruSettings.get.defaultTags())
  const [page, setPage] = createState(1)
  const [loading, setLoading] = createState(false)
  const defRating = booruSettings.get.defaultRating()
  const defRatingIdx = Math.max(0, RATINGS.findIndex((r) => r.label.toLowerCase() === defRating))
  const [ratingIdx, setRatingIdx] = createState(defRatingIdx)

  function doSearch(newPage?: number) {
    const p = newPage ?? 1
    setPage(p)
    setLoading(true)
    const rating = RATINGS[ratingIdx()].tag
    searchPosts(query(), p, rating)
      .then((results) => setPosts(results))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }

  visible.subscribe(() => {
    if (visible() && posts().length === 0) doSearch()
  })

  const rows = createMemo(() => {
    const all = posts()
    const result: BooruPost[][] = []
    for (let i = 0; i < all.length; i += 2) {
      result.push(all.slice(i, i + 2))
    }
    return result
  })

  function onKeyPress(_: Astal.EventBox | Gtk.Entry, event: Gdk.EventKey) {
    const keyval = event.get_keyval()[1]
    if (keyval === Gdk.KEY_Escape) {
      hide()
    }
  }

  function onSearchActivate() {
    doSearch(1)
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
      <box class="booru-backdrop">
        <box class="booru-panel" vertical>
          <box class="booru-header">
            <label class="booru-title" label="Booru" xalign={0} hexpand />
            <button
              class="booru-refresh-btn"
              onClicked={() => doSearch(page())}
            >
              <icon icon="view-refresh-symbolic" />
            </button>
          </box>

          <entry
            class="booru-search"
            placeholder_text="Search tags..."
            onChanged={(self) => setQuery(self.get_text())}
            onActivate={onSearchActivate}
            $={(self) => {
              visible.subscribe(() => {
                if (visible()) {
                  self.grab_focus()
                }
              })
            }}
            onKeyPressEvent={onKeyPress}
          />

          <box class="booru-rating-bar">
            {RATINGS.map((r, i) => (
              <button
                class={createMemo(() =>
                  ratingIdx() === i
                    ? "booru-rating-btn active"
                    : "booru-rating-btn",
                )}
                onClicked={() => {
                  setRatingIdx(i)
                  doSearch(1)
                }}
              >
                <label label={r.label} />
              </button>
            ))}
          </box>

          <scrollable
            class="booru-grid-scroll"
            vscrollbar_policy={Gtk.PolicyType.AUTOMATIC}
            hscrollbar_policy={Gtk.PolicyType.NEVER}
            vexpand
          >
            <box class="booru-grid" vertical>
              <label
                class="booru-status-msg"
                label="Loading..."
                hexpand
                vexpand
                visible={loading}
              />
              <label
                class="booru-status-msg"
                label="No results"
                hexpand
                vexpand
                visible={createMemo(
                  () => !loading() && posts().length === 0,
                )}
              />
              <For each={rows} id={(row) => row.map((p) => p.id).join("-")}>
                {(row) => (
                  <box class="booru-row">
                    {row.map((post) => BooruCard(post))}
                  </box>
                )}
              </For>
            </box>
          </scrollable>

          <box class="booru-footer">
            <button
              class="booru-page-btn"
              onClicked={() => {
                if (page() > 1) doSearch(page() - 1)
              }}
              sensitive={createMemo(() => page() > 1)}
            >
              <label label="Prev" />
            </button>
            <label
              class="booru-footer-page"
              label={createMemo(() => `Page ${page()}`)}
              hexpand
            />
            <button
              class="booru-page-btn"
              onClicked={() => doSearch(page() + 1)}
              sensitive={createMemo(() => posts().length === 20)}
            >
              <label label="Next" />
            </button>
            <label class="booru-footer-keys" label="Esc close" />
          </box>
        </box>
        <box hexpand />
      </box>
    </eventbox>
  )
}
