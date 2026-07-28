import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { HOMEBREW_PACK_ID, type ContentPack, type Rule, type Spell, type Statblock } from '../types'
import {
  buildCompendium,
  dedupeByName,
  entryKey,
  findRuleByName,
  findSpellByName,
  orderPacks,
  originBadgeClass,
  originBadgeLabel,
  originLabel,
} from './compendium'
import type { CompendiumEntry, Origin } from './compendium'

function makeSpell(id: string, name: string): Spell {
  return {
    id,
    name,
    source: 'TEST',
    level: 1,
    school: 'Evocation',
    castingTime: '1 Action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    text: ['Test spell text.'],
    higherLevel: [],
  }
}

const pack: ContentPack = {
  packId: 'spell-pack',
  name: 'Spell Pack',
  version: '1.0.0',
  spells: [makeSpell('sp-frostbolt', 'Frost Bolt'), makeSpell('pack-fireball', 'Fireball')],
}

describe('findSpellByName', () => {
  beforeAll(async () => {
    await db.spells.put(makeSpell('srd-fireball', 'Fireball'))
    await db.packs.put(pack)
  })

  it('finds spells case-insensitively', async () => {
    expect((await findSpellByName('frost bolt'))?.entry.id).toBe('sp-frostbolt')
    expect((await findSpellByName('FROST BOLT'))?.entry.id).toBe('sp-frostbolt')
    expect((await findSpellByName(' Frost Bolt '))?.entry.id).toBe('sp-frostbolt')
  })

  it('prefers the pack variant over SRD (mirrors browse-list precedence)', async () => {
    expect((await findSpellByName('Fireball'))?.entry.id).toBe('pack-fireball')
  })

  it('reports the pack it came from so detail views can name the provenance', async () => {
    expect((await findSpellByName('Fireball'))?.origin).toEqual({
      kind: 'pack',
      packId: 'spell-pack',
      packName: 'Spell Pack',
    })
  })

  it('falls back to SRD when no pack has the spell', async () => {
    await db.packs.clear()
    const hit = await findSpellByName('Fireball')
    expect(hit?.entry.id).toBe('srd-fireball')
    expect(hit?.origin.kind).toBe('srd')
    await db.packs.put(pack)
  })

  it('returns undefined for unknown spells', async () => {
    expect(await findSpellByName('Meteor Storm')).toBeUndefined()
  })
})

describe('dedupeByName', () => {
  const srd: Origin = { kind: 'srd' }
  const pack: Origin = { kind: 'pack', packId: 'phb-2024', packName: 'PHB 2024' }
  const wrap = (name: string, origin: Origin): CompendiumEntry<{ name: string }> => ({
    entry: { name },
    origin,
  })

  it('drops a same-name SRD entry so the pack variant wins', () => {
    const out = dedupeByName([wrap('Fireball', pack)], [wrap('Fireball', srd)])
    expect(out).toHaveLength(1)
    expect(out[0].origin.kind).toBe('pack')
  })

  it('keeps entries with differing names', () => {
    const out = dedupeByName([wrap('Frost Bolt', pack)], [wrap('Fireball', srd)])
    expect(out).toHaveLength(2)
  })

  it('matches case- and whitespace-insensitively', () => {
    const out = dedupeByName([wrap(' fIREBALL ', pack)], [wrap('Fireball', srd)])
    expect(out).toHaveLength(1)
    expect(out[0].origin.kind).toBe('pack')
  })

  it('lets a higher-precedence source win across all sources', () => {
    const hb: Origin = { kind: 'pack', packId: HOMEBREW_PACK_ID, packName: 'Homebrew' }
    const out = dedupeByName([wrap('Goblin', hb)], [wrap('Goblin', pack)], [wrap('Goblin', srd)])
    expect(out).toHaveLength(1)
    expect(out[0].origin).toEqual(hb)
  })
})

function makeRule(id: string, name: string): Rule {
  return { id, name, source: 'TEST', page: 1, text: ['Test rule text.'] }
}

describe('findRuleByName', () => {
  beforeAll(async () => {
    await db.rules.put(makeRule('srd-cover', 'Cover'))
  })

  it('finds rules case-insensitively', async () => {
    expect((await findRuleByName('Cover'))?.entry.id).toBe('srd-cover')
    expect((await findRuleByName('cOVER'))?.entry.id).toBe('srd-cover')
    expect((await findRuleByName(' Cover '))?.entry.id).toBe('srd-cover')
  })

  it('reports rules as SRD — content packs carry no rules', async () => {
    expect((await findRuleByName('Cover'))?.origin.kind).toBe('srd')
  })

  it('returns undefined for unknown rules', async () => {
    expect(await findRuleByName('Nonexistent Rule')).toBeUndefined()
  })
})

describe('origin labels', () => {
  const packOrigin: Origin = { kind: 'pack', packId: 'phb-2024', packName: 'PHB 2024' }
  // Homebrew is an ordinary pack origin — only these helpers single it out.
  const hbOrigin: Origin = { kind: 'pack', packId: HOMEBREW_PACK_ID, packName: 'Homebrew' }

  it('names the badge variant compactly', () => {
    expect(originBadgeLabel({ kind: 'srd' })).toBe('SRD')
    expect(originBadgeLabel(packOrigin)).toBe('PHB 2024')
    expect(originBadgeLabel(hbOrigin)).toBe('HB')
  })

  it('spells the provenance out for detail views', () => {
    expect(originLabel({ kind: 'srd' })).toBe('SRD 5.2.1')
    expect(originLabel(packOrigin)).toBe('PHB 2024')
    expect(originLabel(hbOrigin)).toBe('Homebrew')
  })

  it('maps each origin to its badge style', () => {
    expect(originBadgeClass({ kind: 'srd' })).toBe('srd')
    expect(originBadgeClass(packOrigin)).toBe('pack')
    expect(originBadgeClass(hbOrigin)).toBe('hb')
  })
})

describe('entryKey', () => {
  it('stays unique when two packs hold the same entry id', () => {
    const a: Origin = { kind: 'pack', packId: 'xphb-2024', packName: 'PHB' }
    const b: Origin = { kind: 'pack', packId: 'xdmg-2024', packName: 'DMG' }
    expect(entryKey(a, 'xphb-longsword')).not.toBe(entryKey(b, 'xphb-longsword'))
  })

  it('separates the same id across origin kinds', () => {
    const hb: Origin = { kind: 'pack', packId: HOMEBREW_PACK_ID, packName: 'Homebrew' }
    expect(entryKey({ kind: 'srd' }, 'goblin')).not.toBe(entryKey(hb, 'goblin'))
  })
})

describe('orderPacks', () => {
  it('puts Homebrew first so it takes precedence over imported packs', () => {
    const imported: ContentPack = { packId: 'xmm-2024', name: 'MM', version: '1', monsters: [] }
    const homebrew: ContentPack = { packId: HOMEBREW_PACK_ID, name: 'Homebrew', version: '1', monsters: [] }
    expect(orderPacks([imported, homebrew]).map((p) => p.packId)).toEqual([HOMEBREW_PACK_ID, 'xmm-2024'])
    expect(orderPacks([homebrew, imported]).map((p) => p.packId)).toEqual([HOMEBREW_PACK_ID, 'xmm-2024'])
  })
})

describe('buildCompendium', () => {
  const statblock = (id: string, name: string) =>
    ({ id, name, source: 'HB', ac: 10, hp: { average: 10 }, initiativeBonus: 0 }) as unknown as Statblock

  const empty = { monsters: [], spells: [], items: [], rules: [] }

  const homebrew: ContentPack = {
    packId: HOMEBREW_PACK_ID,
    name: 'Homebrew',
    version: '1',
    monsters: [statblock('hb-1', 'Custom Goblin')],
    pcs: [statblock('hb-2', 'Thoric')],
  }
  const party: ContentPack = {
    packId: 'party',
    name: 'The Party',
    version: '1',
    pcs: [statblock('p-1', 'Bob')],
  }

  it('collects PCs from every pack into one list', () => {
    const data = buildCompendium({ ...empty, packs: orderPacks([party, homebrew]) })
    expect(data.pcs.map((p) => p.entry.name)).toEqual(['Thoric', 'Bob'])
  })

  it('keeps PCs out of the monsters list and monsters out of the PC list', () => {
    const data = buildCompendium({ ...empty, packs: [homebrew] })
    expect(data.monsters.map((m) => m.entry.name)).toEqual(['Custom Goblin'])
    expect(data.pcs.map((p) => p.entry.name)).toEqual(['Thoric'])
  })

  it('does not let a PC shadow a same-named SRD monster', () => {
    const srdGoblin = statblock('srd-goblin', 'Bob')
    const data = buildCompendium({ ...empty, monsters: [srdGoblin], packs: [party] })
    expect(data.monsters.map((m) => m.entry.id)).toEqual(['srd-goblin'])
    expect(data.pcs.map((p) => p.entry.id)).toEqual(['p-1'])
  })

  it('keeps same-named PCs from different packs — two parties can each have a Bob', () => {
    const other: ContentPack = { packId: 'other', name: 'Other', version: '1', pcs: [statblock('o-1', 'Bob')] }
    const data = buildCompendium({ ...empty, packs: [party, other] })
    expect(data.pcs).toHaveLength(2)
  })

  it('gives every pack — Homebrew included — a uniform pack origin', () => {
    const data = buildCompendium({ ...empty, packs: orderPacks([party, homebrew]) })
    expect(data.pcs[0].origin).toEqual({ kind: 'pack', packId: HOMEBREW_PACK_ID, packName: 'Homebrew' })
    expect(data.pcs[1].origin).toEqual({ kind: 'pack', packId: 'party', packName: 'The Party' })
  })

  it('still shadows SRD content with a pack variant', () => {
    const srdGoblin = statblock('srd-goblin', 'Custom Goblin')
    const data = buildCompendium({ ...empty, monsters: [srdGoblin], packs: [homebrew] })
    expect(data.monsters).toHaveLength(1)
    expect(data.monsters[0].entry.id).toBe('hb-1')
  })
})
