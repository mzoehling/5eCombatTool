// Dice-expression parser and roller for the Dice Roller popup (and, later,
// clickable damage links in statblocks). Accepts statblock notation ("1d8",
// "2d6 + 3", "1d4 - 1", "d10") and German "w" notation ("1w8", "3w8+5+2w4"),
// case-insensitive, with or without spaces.

import { rollDie } from './dice'

export type DiceTerm =
  | { kind: 'dice'; sign: 1 | -1; count: number; sides: number }
  | { kind: 'flat'; sign: 1 | -1; value: number }

export interface RolledTerm {
  term: DiceTerm
  /** Individual die results; empty for flat modifiers. */
  rolls: number[]
  /** Signed contribution to the total. */
  subtotal: number
  /** Canonical unsigned display, e.g. "3d8" or "5". */
  label: string
}

export interface DiceRollResult {
  input: string
  total: number
  terms: RolledTerm[]
}

const MAX_DICE = 100
const MAX_SIDES = 1000

/**
 * Parses a +/- chain of dice and flat terms; null when the input isn't a
 * valid expression (or is absurdly large).
 */
export function parseDiceExpression(input: string): DiceTerm[] | null {
  // collapse spaces around operators only — "2d6 3" must not become "2d63"
  const cleaned = input.trim().replace(/\s*([+-])\s*/g, '$1').toLowerCase()
  if (!cleaned || /\s/.test(cleaned)) return null
  const term = /([+-]?)(?:(\d*)[dw](\d+)|(\d+))/y
  const terms: DiceTerm[] = []
  let pos = 0
  while (pos < cleaned.length) {
    term.lastIndex = pos
    const m = term.exec(cleaned)
    if (!m) return null
    if (pos > 0 && !m[1]) return null // terms after the first need an explicit + or -
    const sign = m[1] === '-' ? -1 : 1
    if (m[3] !== undefined) {
      const count = m[2] ? Number.parseInt(m[2], 10) : 1
      const sides = Number.parseInt(m[3], 10)
      if (count < 1 || count > MAX_DICE || sides < 1 || sides > MAX_SIDES) return null
      terms.push({ kind: 'dice', sign, count, sides })
    } else {
      terms.push({ kind: 'flat', sign, value: Number.parseInt(m[4], 10) })
    }
    pos = term.lastIndex
  }
  return terms
}

/** Rolls a parsed or raw expression; null on invalid input. `roll` is injectable for tests. */
export function rollDiceExpression(input: string, roll: (sides: number) => number = rollDie): DiceRollResult | null {
  const terms = parseDiceExpression(input)
  if (!terms) return null
  let total = 0
  const rolled = terms.map((term): RolledTerm => {
    if (term.kind === 'flat') {
      const subtotal = term.sign * term.value
      total += subtotal
      return { term, rolls: [], subtotal, label: String(term.value) }
    }
    const rolls = Array.from({ length: term.count }, () => roll(term.sides))
    const subtotal = term.sign * rolls.reduce((a, b) => a + b, 0)
    total += subtotal
    return { term, rolls, subtotal, label: `${term.count}d${term.sides}` }
  })
  return { input: input.trim(), total, terms: rolled }
}

/** "3d8 (6, 2, 8) + 5 + 2d4 (3, 1)" — human-readable trace of one roll. */
export function formatBreakdown(result: DiceRollResult): string {
  return result.terms
    .map((t, i) => {
      const op = i === 0 ? (t.term.sign < 0 ? '−' : '') : t.term.sign < 0 ? ' − ' : ' + '
      const body = t.term.kind === 'dice' ? `${t.label} (${t.rolls.join(', ')})` : t.label
      return op + body
    })
    .join('')
}
