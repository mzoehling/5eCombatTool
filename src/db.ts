import Dexie, { type EntityTable } from 'dexie'
import type { Battle, Combatant, ContentPack, HomebrewEntry, Item, Spell, Statblock } from './types'

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
  }
}

export const db = new CombatDb()
