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

/** Damage after a save: a success halves it, rounding down, to a minimum of 0. */
export function amountAfterSave(amount: number, verdict: SaveVerdict | undefined): number {
  return verdict === 'saved' ? Math.floor(amount / 2) : amount
}
