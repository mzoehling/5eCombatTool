/**
 * Evaluates simple arithmetic HP input like "10+3", "25-7+2", or "14".
 * Returns null for anything that isn't a plain +/- expression.
 */
export function evalArithmetic(input: string): number | null {
  const cleaned = input.replace(/\s/g, '')
  if (!/^[+-]?\d+([+-]\d+)*$/.test(cleaned)) return null
  let total = 0
  for (const match of cleaned.matchAll(/([+-]?)(\d+)/g)) {
    const value = Number.parseInt(match[2], 10)
    total += match[1] === '-' ? -value : value
  }
  return total
}
