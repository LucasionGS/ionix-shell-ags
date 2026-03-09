import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import { createState } from "gnim"
import style from "./style.scss"
import panels from "./panels/index"
import { getEngine } from "./panels/automation/engine"

// Create state for each panel before app.start so both main() and
// requestHandler() can reference them.
const panelStates = new Map(
  panels.map((p) => [p.id, createState(false)] as const),
)

app.start({
  instanceName: "ion-ags",
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
        setVisible(!visible())
    }

    res("ok")
  },

  main() {
    for (const panel of panels) {
      const [visible, setVisible] = panelStates.get(panel.id)!
      const hide = () => setVisible(false)

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

      win.add(panel.setup(visible, hide))

      // Sync window visibility with panel state
      visible.subscribe(() => {
        win.visible = visible()
      })
    }

    // Start automation engine
    getEngine().start()
  },
})
