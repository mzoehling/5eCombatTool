import Dexie, { type EntityTable } from 'dexie'
import type { Battle, Combatant, ContentPack, HomebrewEntry, Item, Rule, SavedEncounter, Spell, Statblock } from './types'

/** Key/value store for app metadata (e.g. bundled-data version, last backup export). */
export interface MetaEntry {
  key: string
  value: string
}

export class CombatDb extends Dexie {
  monsters!: EntityTable<Statblock, 'id'>
  spells!: EntityTable<Spell, 'id'>
  items!: EntityTable<Item, 'id'>
  packs!: EntityTable<ContentPack, 'packId'>
  homebrew!: EntityTable<HomebrewEntry, 'id'>
  combatants!: EntityTable<Combatant, 'id'>
  battle!: EntityTable<Battle, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>
  encounters!: EntityTable<SavedEncounter, 'id'>
  rules!: EntityTable<Rule, 'id'>

  constructor(name = '5eCombatTool') {
    super(name)
    this.version(1).stores({
      monsters: 'id, name, crNumeric',
      spells: 'id, name, level',
      items: 'id, name, rarity',
      packs: 'packId',
      homebrew: 'id, name, kind',
      combatants: 'id, sortIndex, groupId',
      battle: 'id',
      meta: 'key',
    })
    // v2: saved-encounter library
    this.version(2).stores({
      encounters: 'id, name',
    })
    // v3: rules glossary
    this.version(3).stores({
      rules: 'id, name',
    })
  }
}

export const db = new CombatDb()
