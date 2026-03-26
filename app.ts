import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createState } from "gnim"
import style from "./style.scss"
import panels from "./panels/index"
import { getEngine } from "./panels/automation/engine"
import { registerPanelToggle } from "./panels/panel-toggle"
import { invokePanelAction } from "./panels/panel-action"
import { DesktopPanel } from "./panels/desktop/DesktopPanel"

// Create state for each panel before app.start so both main() and
// requestHandler() can reference them.
const panelStates = new Map(
  panels.map((p) => [p.id, createState(false)] as const),
)

// Register togglers so providers can toggle panels directly (no IPC)
for (const [id, [visible, setVisible]] of panelStates) {
  registerPanelToggle(id, () => setVisible(!visible()))
}

app.start({
  instanceName: "ionix-shell",
  css: style,

  requestHandler(argv, res) {
    const [cmd, action] = argv

    const panel = panelStates.get(cmd)
    if (!panel) {
      res(`unknown panel: ${cmd}`)
      return
    }

    const [visible, setVisible] = panel
    switch (action) {
      case "toggle":
        setVisible(!visible())
        break
      case "show":
        setVisible(true)
        break
      case "hide":
        setVisible(false)
        break
      default:
        if (!invokePanelAction(cmd, action)) {
          setVisible(!visible())
        }
    }

    res("ok")
  },

  main() {
    for (const panel of panels) {
      const [visible, setVisible] = panelStates.get(panel.id)!
      const hide = () => setVisible(false)
      const show = () => setVisible(true)

      // Each panel's setup function creates the window content.
      // The window is created here so the registry controls all
      // window properties uniformly.
      const win = new Astal.Window({
        name: panel.id,
        application: app,
        anchor: panel.anchor,
        keymode: panel.keymode ?? Astal.Keymode.NONE,
        exclusivity: panel.exclusivity ?? Astal.Exclusivity.NORMAL,
        layer: panel.layer ?? Astal.Layer.TOP,
        visible: false,
      })

      win.add(panel.setup(visible, hide, show))

      // Sync window visibility with panel state
      visible.subscribe(() => {
        win.visible = visible()
      })
    }

    // Start automation engine
    getEngine().start()

    // Desktop layer — always visible, sits above wallpaper
    const desktopWin = new Astal.Window({
      name: "desktop",
      application: app,
      anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM |
              Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT,
      keymode: Astal.Keymode.NONE,
      exclusivity: Astal.Exclusivity.NORMAL,
      layer: Astal.Layer.BOTTOM,
      visible: true,
    })
    desktopWin.add(DesktopPanel())
  },
})
