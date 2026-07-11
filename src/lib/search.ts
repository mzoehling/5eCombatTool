/** Strips tracker postfixes for lookups: "Goblin A" → "Goblin", "Wolf 3" → "Wolf". */
export function stripPostfix(name: string): string {
  return name.replace(/\s+([A-Z]|\d+)$/, '')
}

/**
 * Fuzzy match score: higher is better, -1 means no match.
 * Exact > prefix > word-prefix > substring > subsequence.
 */
export function searchScore(name: string, query: string): number {
  const n = name.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (n === q) return 100
  if (n.startsWith(q)) return 90
  if (n.includes(` ${q}`)) return 80
  if (n.includes(q)) return 60
  // subsequence: all query chars appear in order
  let i = 0
  for (const ch of n) {
    if (ch === q[i]) i++
    if (i === q.length) return 30
  }
  return -1
}

/** Filters and ranks by fuzzy score, ties alphabetical. */
export function rankByName<T>(items: T[], query: string, nameOf: (item: T) => string): T[] {
  if (!query.trim()) return [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  return items
    .map((item) => ({ item, score: searchScore(nameOf(item), query) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || nameOf(a.item).localeCompare(nameOf(b.item)))
    .map((x) => x.item)
}

/**
 * Names for adding `count` copies of `base`, continuing "A", "B", … after
 * whatever suffixed copies already exist. A single copy with no clash keeps
 * the plain name.
 */
export function suffixedNames(base: string, count: number, existingNames: string[]): string[] {
  const existing = new Set(existingNames)
  const hasRelated = existingNames.some((n) => n === base || stripPostfix(n) === base)
  if (count === 1 && !hasRelated) return [base]

  const names: string[] = []
  let letter = 0
  while (names.length < count) {
    // A…Z, then A2, B2, …
    const round = Math.floor(letter / 26)
    const candidate = `${base} ${String.fromCharCode(65 + (letter % 26))}${round ? round + 1 : ''}`
    if (!existing.has(candidate)) names.push(candidate)
    letter++
  }
  return names
}
