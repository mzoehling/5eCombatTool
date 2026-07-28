import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import type { ContentPack, Rule, Spell } from '../types'
import { dedupeByName, findRuleByName, findSpellByName, originBadgeLabel, originLabel } from './compendium'
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
    expect((await findSpellByName('Fireball'))?.origin).toEqual({ kind: 'pack', packName: 'Spell Pack' })
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
  const pack: Origin = { kind: 'pack', packName: 'PHB 2024' }
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
    const hb: Origin = { kind: 'homebrew', isPC: false }
    const out = dedupeByName([wrap('Goblin', hb)], [wrap('Goblin', pack)], [wrap('Goblin', srd)])
    expect(out).toHaveLength(1)
    expect(out[0].origin.kind).toBe('homebrew')
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
  it('names the badge variant compactly', () => {
    expect(originBadgeLabel({ kind: 'srd' })).toBe('SRD')
    expect(originBadgeLabel({ kind: 'pack', packName: 'PHB 2024' })).toBe('PHB 2024')
    expect(originBadgeLabel({ kind: 'homebrew', isPC: false })).toBe('HB')
    expect(originBadgeLabel({ kind: 'homebrew', isPC: true })).toBe('PC')
  })

  it('spells the provenance out for detail views', () => {
    expect(originLabel({ kind: 'srd' })).toBe('SRD 5.2.1')
    expect(originLabel({ kind: 'pack', packName: 'PHB 2024' })).toBe('PHB 2024')
    expect(originLabel({ kind: 'homebrew', isPC: false })).toBe('Homebrew')
    expect(originLabel({ kind: 'homebrew', isPC: true })).toBe('Player character')
  })
})
