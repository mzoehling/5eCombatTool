import { abilityMod, type Ability, type Combatant } from '../types'

export const SAVE_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * A combatant's saving-throw bonus for one ability: the statblock's own save if
 * it has a proficiency, otherwise the plain ability modifier. Combatants added
 * by hand carry no statblock, so they save at +0 rather than being excluded —
 * a DM can still flip the verdict by hand.
 */
export function saveBonus(combatant: Combatant, ability: Ability): number {
  const sb = combatant.statblock
  if (!sb) return 0
  return sb.saves[ability] ?? abilityMod(sb.abilities[ability])
}

export type SaveVerdict = 'saved' | 'failed'

/** A d20 roll against a DC. Equal to the DC succeeds, as in the rules. */
export function readSave(roll: number, bonus: number, dc: number): SaveVerdict {
  return roll + bonus >= dc ? 'saved' : 'failed'
}

/**
 * What one target actually takes: the area's amount times that target's factor,
 * rounded down.
 *
 * This replaced a `amountAfterSave` that knew about exactly one adjustment —
 * halving on a made save. Every other one a DM applies at the same moment
 * (resistance, vulnerability, immunity) is the same arithmetic on a different
 * multiplier, so the multiplier is the thing worth naming. A made save simply
 * seeds the factor at ½.
 *
 * Rounding down throughout, as the rules do, and never below zero.
 */
export function amountWithFactor(amount: number, factor: number): number {
  return Math.max(0, Math.floor(amount * factor))
}
