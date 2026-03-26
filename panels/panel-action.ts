const handlers = new Map<string, (action: string) => void>()

export function registerPanelAction(
  id: string,
  handler: (action: string) => void,
): void {
  handlers.set(id, handler)
}

export function invokePanelAction(id: string, action: string): boolean {
  const h = handlers.get(id)
  if (!h) return false
  h(action)
  return true
}
