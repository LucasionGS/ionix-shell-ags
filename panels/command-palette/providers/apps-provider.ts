import Gio from "gi://Gio"
import type { CommandProvider } from "./types"

export const appsProvider: CommandProvider = {
  category: "app",
  label: "Applications",
  icon: "application-x-executable-symbolic",
  fetch() {
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
            appInfo.launch([], null)
          },
        }
      })
  },
}
