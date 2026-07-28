import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { emptyForm, formToStatblock } from '../lib/homebrewForm'
import { HOMEBREW_PACK_ID } from '../types'
import {
  deleteHomebrewEntry,
  getHomebrewPack,
  homebrewCount,
  moveHomebrewEntry,
  saveHomebrewEntry,
} from './homebrewPack'

const sb = (name: string, over: Record<string, unknown> = {}) => ({
  ...formToStatblock({ ...emptyForm, name }, `hb-${name.toLowerCase()}`),
  ...over,
})

async function withDb(run: (db: CombatDb) => Promise<void>) {
  const db = new CombatDb(`test-${crypto.randomUUID()}`)
  try {
    await run(db)
  } finally {
    await db.delete()
  }
}

describe('getHomebrewPack', () => {
  it('returns an empty pack before anything is authored, so first run needs no special case', async () => {
    await withDb(async (db) => {
      const pack = await getHomebrewPack(db)
      expect(pack.packId).toBe(HOMEBREW_PACK_ID)
      expect(pack.monsters).toEqual([])
      expect(pack.pcs).toEqual([])
    })
  })
})

describe('saveHomebrewEntry', () => {
  it('adds entries to the section it is given', async () => {
    await withDb(async (db) => {
      await saveHomebrewEntry('monsters', sb('Custom Goblin'), db)
      await saveHomebrewEntry('pcs', sb('Thoric'), db)
      const pack = await getHomebrewPack(db)
      expect(pack.monsters?.map((m) => m.name)).toEqual(['Custom Goblin'])
      expect(pack.pcs?.map((p) => p.name)).toEqual(['Thoric'])
    })
  })

  it('replaces an entry with the same id instead of duplicating it', async () => {
    await withDb(async (db) => {
      await saveHomebrewEntry('monsters', sb('Custom Goblin', { ac: 12 }), db)
      await saveHomebrewEntry('monsters', sb('Custom Goblin', { ac: 18 }), db)
      const monsters = (await getHomebrewPack(db)).monsters
      expect(monsters).toHaveLength(1)
      expect(monsters?.[0].ac).toBe(18)
    })
  })

  it('does not lose entries when saves overlap', async () => {
    await withDb(async (db) => {
      // Everything the user authors lives in one row, so concurrent saves would
      // clobber each other without the transaction in updateHomebrewPack.
      await Promise.all([
        saveHomebrewEntry('monsters', sb('Alpha'), db),
        saveHomebrewEntry('monsters', sb('Beta'), db),
        saveHomebrewEntry('pcs', sb('Gamma'), db),
      ])
      expect(await homebrewCount(db)).toBe(3)
    })
  })
})

describe('deleteHomebrewEntry', () => {
  it('removes only the named entry from its section', async () => {
    await withDb(async (db) => {
      await saveHomebrewEntry('monsters', sb('Alpha'), db)
      await saveHomebrewEntry('monsters', sb('Beta'), db)
      await deleteHomebrewEntry('monsters', 'hb-alpha', db)
      expect((await getHomebrewPack(db)).monsters?.map((m) => m.name)).toEqual(['Beta'])
    })
  })
})

describe('moveHomebrewEntry', () => {
  it('moves an entry between sections, so a monster can become a PC', async () => {
    await withDb(async (db) => {
      await saveHomebrewEntry('monsters', sb('Thoric'), db)
      await moveHomebrewEntry('monsters', 'pcs', 'hb-thoric', db)
      const pack = await getHomebrewPack(db)
      expect(pack.monsters).toEqual([])
      expect(pack.pcs?.map((p) => p.name)).toEqual(['Thoric'])
    })
  })

  it('leaves the pack alone when the entry is not in the source section', async () => {
    await withDb(async (db) => {
      await saveHomebrewEntry('pcs', sb('Thoric'), db)
      await moveHomebrewEntry('monsters', 'pcs', 'hb-thoric', db)
      expect(await homebrewCount(db)).toBe(1)
    })
  })
})

describe('homebrewCount', () => {
  it('counts both sections, and is zero before anything is authored', async () => {
    await withDb(async (db) => {
      expect(await homebrewCount(db)).toBe(0)
      await saveHomebrewEntry('monsters', sb('Alpha'), db)
      await saveHomebrewEntry('pcs', sb('Thoric'), db)
      expect(await homebrewCount(db)).toBe(2)
    })
  })
})
