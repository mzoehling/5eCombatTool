// Core data model — see the local SPEC for its derivation.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export type AbilityScores = Record<Ability, number>

/** 2024 condition set plus Concentration and Exhaustion. */
export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
  'Exhaustion',
  'Concentration',
] as const

export type ConditionName = (typeof CONDITIONS)[number]

export interface ConditionInstance {
  condition: ConditionName
  /** Duration in rounds; decremented at the affected creature's turn start. */
  remainingRounds?: number
  /** Exhaustion level 1-6. */
  level?: number
  note?: string
}

export interface LimitedUse {
  id: string
  name: string
  max: number
  used: number
  /** e.g. "day" (X/Day), "recharge:5" (Recharge 5-6), "legendary" */
  rechargeRule?: string
}

/** A named entry of a statblock (trait, action, …). Text keeps inline {@…} tags; rendering resolves them. */
export interface StatblockEntry {
  name?: string
  /** Flattened paragraphs (lists/tables reduced to lines). */
  text: string[]
}

export interface SpeedEntry {
  /** walk | fly | swim | climb | burrow */
  mode: string
  value: number
  /** e.g. "(hover)" */
  condition?: string
}

export interface SpellcastingList {
  /** e.g. "At Will", "3/Day Each", "Legendary", "1st Level (4 Slots)" */
  label: string
  /** Number of uses/slots this list shares, if limited. */
  uses?: number
  /** True when each listed spell has its own allotment ("each"). */
  perSpell?: boolean
  /** Spell names with tags intact. */
  spells: string[]
}

export interface SpellcastingBlock {
  name: string
  /** Intro text (ability, DC, attack bonus) with tags intact. */
  headerText: string[]
  lists: SpellcastingList[]
}

/** Normalized monster statblock (2024 fields included). */
export interface Statblock {
  id: string
  name: string
  /** Book abbreviation, e.g. "XMM". */
  source: string
  size: string[]
  type: string
  typeTags: string[]
  alignment: string
  ac: number
  acFrom?: string
  hp: {
    average: number
    formula?: string
    special?: string
  }
  speed: SpeedEntry[]
  abilities: AbilityScores
  saves: Partial<Record<Ability, number>>
  skills: Record<string, number>
  senses: string[]
  passivePerception?: number
  languages: string[]
  /** Display CR, e.g. "17" or "1/2". Undefined for unrated creatures. */
  cr?: string
  /** CR as a number for filtering and proficiency-bonus derivation. */
  crNumeric?: number
  /** Computed per SPEC: DEX mod + proficiency × prof bonus, flat value, or DEX mod. */
  initiativeBonus: number
  /** 2024 combined damage + condition immunities line. */
  immunities?: string
  resistances?: string
  vulnerabilities?: string
  /** 2024 gear list (tags intact). */
  gear: string[]
  traits: StatblockEntry[]
  actions: StatblockEntry[]
  bonusActions: StatblockEntry[]
  reactions: StatblockEntry[]
  legendary: StatblockEntry[]
  /** Legendary action budget, e.g. 3. */
  legendaryActions?: number
  legendaryHeader?: string[]
  lair: StatblockEntry[]
  spellcasting: SpellcastingBlock[]
}

export interface Spell {
  id: string
  name: string
  source: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  concentration: boolean
  ritual: boolean
  /** Body paragraphs with tags intact. */
  text: string[]
  /** "Using a Higher-Level Spell Slot" paragraphs. */
  higherLevel: string[]
}

export interface Item {
  id: string
  name: string
  source: string
  /** Human-readable type, e.g. "Weapon (Longsword)", "Wondrous Item". */
  typeName: string
  rarity?: string
  attunement?: string
  weight?: number
  /** Cost in copper pieces. */
  valueCp?: number
  text: string[]
}

export interface Combatant {
  id: string
  name: string
  hp: number
  maxHp: number
  /** Temp HP absorbs damage first. */
  tempHp: number
  armorClass: number
  /** null until rolled/entered. */
  initiative: number | null
  initiativeBonus: number
  groupId?: string
  /** Manual order among initiative ties (lower first). */
  sortIndex: number
  /** Participates in the battle (false: reserve/out). */
  isActive: boolean
  isPC: boolean
  /** Player View (post-v1): hidden combatants never appear in player snapshots. */
  hiddenFromPlayers: boolean
  conditions: ConditionInstance[]
  limits: LimitedUse[]
  /** Embedded copy — battle entries stay stable if compendium data changes. */
  statblock?: Statblock
}

export interface Group {
  id: string
  name: string
  inBattle: boolean
}

/** Singleton battle state (id "current"); serializable for the future Player View broadcaster. */
export interface Battle {
  id: string
  round: number
  activeCombatantId: string | null
  isRunning: boolean
  groups: Group[]
}

export type HomebrewKind = 'monster' | 'pc'

export interface HomebrewEntry {
  id: string
  kind: HomebrewKind
  statblock: Statblock
  createdAt: number
  updatedAt: number
}

/** Versioned content-pack format; produced externally, imported via file picker. */
export interface ContentPack {
  packId: string
  name: string
  version: string
  monsters?: Statblock[]
  spells?: Spell[]
  items?: Item[]
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

/** Proficiency bonus by CR (DMG table); CR 0-3 → +2 … CR 29+ → +9. */
export function proficiencyByCr(crNumeric: number | undefined): number {
  if (crNumeric === undefined) return 2
  return Math.max(2, Math.ceil(crNumeric / 4) + 1)
}
