const togglers = new Map<string, () => void>()

export function registerPanelToggle(id: string, toggle: () => void) {
  togglers.set(id, toggle)
}

export function togglePanel(id: string) {
  togglers.get(id)?.()
}
