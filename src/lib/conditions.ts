import { CONDITIONS, SPELL_EFFECTS, type Combatant, type ConditionInstance } from '../types'

/**
 * How a condition is spread across the combatants a dialog is aimed at.
 *
 * One target is the common case and reads as on/off. Several targets rarely
 * agree — an area effect catches some who already had it — so the list has to
 * say "on 2 of 5" rather than pretend the answer is binary.
 */
export interface ConditionSpread {
  on: number
  total: number
  /** Every target has it. */
  all: boolean
  /** No target has it. */
  none: boolean
}

export function conditionSpread(targets: readonly Combatant[], condition: string): ConditionSpread {
  const on = targets.filter((t) => t.conditions.some((c) => c.condition === condition)).length
  return { on, total: targets.length, all: targets.length > 0 && on === targets.length, none: on === 0 }
}

/** Conditions in play that are neither official nor a listed spell effect. */
export function customConditions(targets: readonly Combatant[]): string[] {
  const known = new Set<string>([...CONDITIONS, ...SPELL_EFFECTS])
  const names = new Set<string>()
  for (const t of targets) {
    for (const c of t.conditions) if (!known.has(c.condition)) names.add(c.condition)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/**
 * Builds the condition to write from a name and the dialog's form fields.
 *
 * A blank or unparseable duration means "until removed" rather than zero rounds,
 * because a zero-round condition would expire the instant it was applied.
 * Exhaustion carries a level instead and is clamped to the 2024 range of 1–6.
 */
export function conditionInstance(name: string, rounds: string, level = '1'): ConditionInstance {
  const parsedRounds = Number.parseInt(rounds, 10)
  const hasRounds = Number.isFinite(parsedRounds) && parsedRounds > 0
  return {
    condition: name,
    ...(hasRounds && { remainingRounds: parsedRounds }),
    ...(name === 'Exhaustion' && { level: Math.min(6, Math.max(1, Number.parseInt(level, 10) || 1)) }),
  }
}
