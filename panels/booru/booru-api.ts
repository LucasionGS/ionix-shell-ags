import GLib from "gi://GLib"
import Gio from "gi://Gio"
import GdkPixbuf from "gi://GdkPixbuf"
import fetch from "ags/fetch"

export interface BooruPost {
  id: number
  tags: string
  file_url: string
  sample_url: string
  preview_url: string
  width: number
  height: number
  sample_width: number
  sample_height: number
  score: number
  rating: string
  file_size: number
  md5: string
}

const BASE_URL = "https://konachan.com/post.json"
const DOWNLOAD_DIR = GLib.build_filenamev([
  GLib.get_home_dir() ?? "/home",
  "Pictures",
  "Booru",
])

export async function searchPosts(
  tags: string,
  page: number,
  rating: string,
): Promise<BooruPost[]> {
  const allTags = rating ? `${tags} ${rating}`.trim() : tags
  const url = `${BASE_URL}?tags=${encodeURIComponent(allTags)}&limit=20&page=${page}`

  const response = await fetch(url)
  if (!response.ok) return []

  return response.json()
}

export async function loadPixbuf(
  url: string,
  width: number,
): Promise<GdkPixbuf.Pixbuf | null> {
  try {
    const response = await fetch(url)
    if (!response.ok || !response.body) return null

    return new Promise((resolve) => {
      GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(
        response.body!,
        width,
        -1,
        true,
        null,
        (_, res) => {
          try {
            resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(res))
          } catch {
            resolve(null)
          }
        },
      )
    })
  } catch {
    return null
  }
}

export async function downloadImage(post: BooruPost, downloadDir?: string): Promise<boolean> {
  try {
    const dir = downloadDir ?? DOWNLOAD_DIR
    GLib.mkdir_with_parents(dir, 0o755)

    const ext = post.file_url.split(".").pop() ?? "jpg"
    const filename = `${post.id}_${post.md5}.${ext}`
    const filepath = GLib.build_filenamev([dir, filename])

    const destFile = Gio.File.new_for_path(filepath)
    if (destFile.query_exists(null)) return true

    const response = await fetch(post.file_url)
    if (!response.ok || !response.body) return false

    const outStream = destFile.create(Gio.FileCreateFlags.NONE, null)

    await new Promise<void>((resolve, reject) => {
      outStream.splice_async(
        response.body!,
        Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
          Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
        GLib.PRIORITY_DEFAULT,
        null,
        (_, res) => {
          try {
            outStream.splice_finish(res)
            resolve()
          } catch (e) {
            reject(e)
          }
        },
      )
    })

    return true
  } catch {
    return false
  }
}
