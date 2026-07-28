import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { importPack, listPacks, removePack, validatePack } from './packs'

const validPack = {
  packId: 'test-pack',
  name: 'Test Pack',
  version: '1.0.0',
  monsters: [{ id: 'tp-goblin-king', name: 'Goblin King' }],
}

describe('validatePack', () => {
  it('accepts a minimal valid pack', () => {
    expect(validatePack(validPack).packId).toBe('test-pack')
  })

  it('rejects non-objects and missing header fields', () => {
    expect(() => validatePack('nope')).toThrow('must be a JSON object')
    expect(() => validatePack([])).toThrow('must be a JSON object')
    expect(() => validatePack({ name: 'x', version: '1' })).toThrow('"packId"')
    expect(() => validatePack({ packId: 'x', version: '1' })).toThrow('"name"')
    expect(() => validatePack({ packId: 'x', name: 'y' })).toThrow('"version"')
  })

  it('rejects empty and malformed content sections', () => {
    expect(() => validatePack({ packId: 'x', name: 'y', version: '1' })).toThrow('no monsters')
    expect(() => validatePack({ ...validPack, monsters: 'many' })).toThrow('must be an array')
    expect(() => validatePack({ ...validPack, monsters: [{ name: 'No Id' }] })).toThrow('monsters[0]')
  })

  it('accepts a pack that carries only PCs', () => {
    const party = { packId: 'party', name: 'The Party', version: '1', pcs: [{ id: 'p-bob', name: 'Bob' }] }
    expect(validatePack(party).pcs).toHaveLength(1)
  })

  it('validates the pcs section like every other section', () => {
    expect(() => validatePack({ ...validPack, pcs: 'many' })).toThrow('must be an array')
    expect(() => validatePack({ ...validPack, pcs: [{ name: 'No Id' }] })).toThrow('pcs[0]')
  })

  it('refuses the reserved Homebrew pack id', () => {
    expect(() => validatePack({ ...validPack, packId: 'homebrew' })).toThrow('reserved pack id')
  })
})

describe('pack import lifecycle', () => {
  it('imports, replaces, lists, and removes packs as a unit', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await importPack(JSON.stringify(validPack), db)
      expect((await listPacks(db)).map((p) => p.name)).toEqual(['Test Pack'])

      // same packId → replace, not duplicate
      await importPack(JSON.stringify({ ...validPack, version: '2.0.0' }), db)
      const packs = await listPacks(db)
      expect(packs).toHaveLength(1)
      expect(packs[0].version).toBe('2.0.0')

      await removePack('test-pack', db)
      expect(await listPacks(db)).toHaveLength(0)
    } finally {
      await db.delete()
    }
  })

  it('rejects invalid JSON text', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await expect(importPack('{not json', db)).rejects.toThrow('not valid JSON')
    } finally {
      await db.delete()
    }
  })

  it('never lets an import or a removal touch the Homebrew pack', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await db.packs.put({ packId: 'homebrew', name: 'Homebrew', version: '1', monsters: [], pcs: [] })
      await expect(importPack(JSON.stringify({ ...validPack, packId: 'homebrew' }), db)).rejects.toThrow(
        'reserved pack id',
      )
      await expect(removePack('homebrew', db)).rejects.toThrow('cannot be removed')
      expect(await db.packs.get('homebrew')).toBeDefined()
    } finally {
      await db.delete()
    }
  })
})
