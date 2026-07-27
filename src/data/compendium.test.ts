import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import type { ContentPack, Rule, Spell } from '../types'
import { dedupeByName, findRuleByName, findSpellByName } from './compendium'
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
  spells: [makeSpell('sp-frostbolt', 'Frost Bolt')],
}

describe('findSpellByName', () => {
  beforeAll(async () => {
    await db.spells.put(makeSpell('srd-fireball', 'Fireball'))
    await db.packs.put(pack)
  })

  it('finds SRD spells case-insensitively', async () => {
    expect((await findSpellByName('Fireball'))?.id).toBe('srd-fireball')
    expect((await findSpellByName('fIREBALL'))?.id).toBe('srd-fireball')
    expect((await findSpellByName(' Fireball '))?.id).toBe('srd-fireball')
  })

  it('falls back to pack spells', async () => {
    expect((await findSpellByName('frost bolt'))?.id).toBe('sp-frostbolt')
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
    expect((await findRuleByName('Cover'))?.id).toBe('srd-cover')
    expect((await findRuleByName('cOVER'))?.id).toBe('srd-cover')
    expect((await findRuleByName(' Cover '))?.id).toBe('srd-cover')
  })

  it('returns undefined for unknown rules', async () => {
    expect(await findRuleByName('Nonexistent Rule')).toBeUndefined()
  })
})
