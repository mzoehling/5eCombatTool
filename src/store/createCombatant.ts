import { newId } from '../lib/id'
import { detectLimitedUses } from '../lib/limitedUses'
import type { Combatant, Statblock } from '../types'

export interface BlankCombatantInput {
  name: string
  maxHp: number
  armorClass: number
  initiativeBonus: number
  isPC: boolean
}

export function combatantFromStatblock(sb: Statblock, name = sb.name, isPC = false): Combatant {
  return {
    id: newId(),
    name,
    hp: sb.hp.average,
    maxHp: sb.hp.average,
    tempHp: 0,
    armorClass: sb.ac,
    initiative: 0,
    initiativeBonus: sb.initiativeBonus,
    sortIndex: 0,
    isActive: true,
    isPC,
    hiddenFromPlayers: false,
    conditions: [],
    limits: detectLimitedUses(sb),
    statblock: sb,
  }
}

export function blankCombatant(input: BlankCombatantInput): Combatant {
  return {
    id: newId(),
    name: input.name,
    hp: input.maxHp,
    maxHp: input.maxHp,
    tempHp: 0,
    armorClass: input.armorClass,
    initiative: 0,
    initiativeBonus: input.initiativeBonus,
    sortIndex: 0,
    isActive: true,
    isPC: input.isPC,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [],
  }
}
