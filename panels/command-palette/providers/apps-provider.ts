import Gio from "gi://Gio"
import Gdk from "gi://Gdk"
import type { CommandProvider, CommandResult } from "./types"

export const appsProvider: CommandProvider = {
  category: "app",
  label: "Applications",
  icon: "application-x-executable-symbolic",
  async fetch(): Promise<CommandResult[]> {
    await new Promise((r) => setTimeout(r, 0))
    const apps = Gio.AppInfo.get_all()
    return apps
      .filter((a) => a.should_show())
      .map((appInfo) => {
        const name = appInfo.get_display_name() ?? appInfo.get_name() ?? ""
        const desc = appInfo.get_description() ?? ""
        const iconObj = appInfo.get_icon()
        const icon =
          iconObj?.to_string() ?? "application-x-executable-symbolic"
        return {
          id: `app:${appInfo.get_id() ?? name}`,
          category: "app" as const,
          name,
          description: desc,
          icon,
          keywords: `${name} ${desc}`.toLowerCase(),
          execute: () => {
            try {
              const ctx = Gdk.Display.get_default()?.get_app_launch_context() ?? null
              appInfo.launch([], ctx)
            } catch (error) {
              appInfo.launch([], null)
            }
          },
        }
      })
  },
}
