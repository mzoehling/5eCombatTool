import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import type { ContentPack, Spell } from '../types'
import { findSpellByName } from './compendium'

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
