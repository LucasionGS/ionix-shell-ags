import { Astal, Gtk, Gdk } from "ags/gtk3"
import { type Accessor } from "gnim"
import GObject from "gnim/gobject"

export interface PanelDefinition {
  id: string
  anchor: number
  keymode?: Astal.Keymode
  exclusivity?: Astal.Exclusivity
  layer?: Astal.Layer
  // Returns a Gtk.Window — the panel owns its own window creation
  setup: (visible: Accessor<boolean>, hide: () => void) => Gtk.Widget | GObject.Object
}
