import type { Combatant } from '../types'

export interface BlankCombatantInput {
  name: string
  maxHp: number
  armorClass: number
  initiativeBonus: number
  isPC: boolean
}

export function blankCombatant(input: BlankCombatantInput): Combatant {
  return {
    id: crypto.randomUUID(),
    name: input.name,
    hp: input.maxHp,
    maxHp: input.maxHp,
    tempHp: 0,
    armorClass: input.armorClass,
    initiative: null,
    initiativeBonus: input.initiativeBonus,
    sortIndex: 0,
    isActive: true,
    isPC: input.isPC,
    hiddenFromPlayers: false,
    conditions: [],
    limits: [],
  }
}
