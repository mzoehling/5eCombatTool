import Dexie, { type EntityTable } from 'dexie'
import { HOMEBREW_PACK_ID, HOMEBREW_PACK_NAME } from './types'
import type {
  Battle,
  Combatant,
  ContentPack,
  HomebrewEntry,
  HomebrewKind,
  Item,
  Rule,
  SavedEncounter,
  Spell,
  Statblock,
} from './types'

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
    // v4: homebrew becomes the reserved "Homebrew" content pack, so app-authored
    // content and imported packs share one storage model. `kind` decides the
    // section: PCs are no longer monsters carrying a flag.
    this.version(4)
      .stores({ homebrew: 'id, kind' })
      .upgrade(async (tx) => {
        const entries = (await tx.table('homebrew').toArray()) as HomebrewEntry[]
        if (!entries.length) return
        const section = (kind: HomebrewKind) =>
          entries.filter((e) => (kind === 'pc' ? e.kind === 'pc' : e.kind !== 'pc')).map((e) => e.statblock)
        const packs = tx.table('packs')
        // Merge rather than overwrite: the row should not exist yet, but losing
        // homebrew to a surprise is not a recoverable mistake — there is no copy
        // of it anywhere else.
        const existing = (await packs.get(HOMEBREW_PACK_ID)) as ContentPack | undefined
        const byId = (...groups: Statblock[][]) => [...new Map(groups.flat().map((sb) => [sb.id, sb])).values()]
        await packs.put({
          packId: HOMEBREW_PACK_ID,
          name: HOMEBREW_PACK_NAME,
          version: String(Date.now()),
          monsters: byId(existing?.monsters ?? [], section('monster')),
          pcs: byId(existing?.pcs ?? [], section('pc')),
        } satisfies ContentPack)
      })
    // v5: drop the now-empty homebrew table. Deliberately a separate version —
    // Dexie removes a table as soon as a version block maps it to null, so the
    // v4 upgrade above could no longer read it.
    this.version(5).stores({ homebrew: null })
  }
}

export const db = new CombatDb()
