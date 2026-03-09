export function fuzzyScore(query: string, target: string): number {
  if (query === "") return 1

  const q = query.toLowerCase()

  if (target.startsWith(q)) return 100

  const wordStart = target.indexOf(" " + q)
  if (wordStart >= 0) return 80

  const idx = target.indexOf(q)
  if (idx >= 0) return 60 - idx * 0.1

  return 0
}
