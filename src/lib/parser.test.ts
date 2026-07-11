import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Statblock } from '../types'
import { parseItem, parseMonster, parseSpell } from './parser'
import { renderTags } from './tagRenderer'

const fixturesDir = resolve(import.meta.dirname, '..', '..', 'fixtures')
const hasFixtures = existsSync(resolve(fixturesDir, 'bestiary', 'bestiary-xmm.json'))

if (!hasFixtures && process.env.CI) {
  throw new Error('Fixtures are required in CI — run `npm run fetch-fixtures` first.')
}

function loadFixture<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(fixturesDir, relPath), 'utf8')) as T
}

/** Every human-readable string of a parsed statblock. */
function allText(sb: Statblock): string[] {
  const out: string[] = [sb.alignment, sb.immunities ?? '', sb.resistances ?? '', sb.vulnerabilities ?? '']
  out.push(...sb.senses, ...sb.languages, ...sb.gear)
  for (const list of [sb.traits, sb.actions, sb.bonusActions, sb.reactions, sb.legendary, sb.lair]) {
    for (const e of list) out.push(e.name ?? '', ...e.text)
  }
  for (const sc of sb.spellcasting) {
    out.push(sc.name, ...sc.headerText)
    for (const l of sc.lists) out.push(l.label, ...l.spells)
  }
  if (sb.legendaryHeader) out.push(...sb.legendaryHeader)
  return out
}

describe.skipIf(!hasFixtures)('parseMonster (bestiary fixture)', () => {
  const monsters = loadFixture<{ monster: Parameters<typeof parseMonster>[0][] }>('bestiary/bestiary-xmm.json').monster

  it('parses all monsters without throwing', () => {
    expect(monsters.length).toBeGreaterThanOrEqual(500)
    for (const raw of monsters) {
      expect(() => parseMonster(raw), raw.name).not.toThrow()
    }
  })

  it('spot-checks the Adult Red Dragon', () => {
    const raw = monsters.find((m) => m.name === 'Adult Red Dragon')
    expect(raw).toBeDefined()
    const dragon = parseMonster(raw!)

    expect(dragon.ac).toBe(19)
    expect(dragon.hp.average).toBe(256)
    expect(dragon.hp.formula).toBe('19d12 + 133')
    expect(dragon.cr).toBe('17')
    expect(dragon.crNumeric).toBe(17)
    // initiative {proficiency: 2}, DEX 10, CR 17 → 0 + 2 × 6 = +12
    expect(dragon.initiativeBonus).toBe(12)

    const spellcasting = dragon.spellcasting[0]
    expect(spellcasting).toBeDefined()
    const atWill = spellcasting.lists.find((l) => l.label === 'At Will')
    expect(atWill?.spells).toHaveLength(3)
    expect(spellcasting.lists.some((l) => l.label === '1/Day')).toBe(true)

    expect(dragon.legendary.length).toBeGreaterThanOrEqual(3)
    expect(dragon.legendaryActions).toBe(3)
    expect(dragon.immunities).toBe('fire')
  })

  it('parses legendary spellcasting lists (Lich)', () => {
    const lich = parseMonster(monsters.find((m) => m.name === 'Lich')!)
    const lists = lich.spellcasting.flatMap((sc) => sc.lists)
    const legendary = lists.find((l) => l.label.includes('Legendary'))
    expect(legendary).toBeDefined()
    expect(legendary!.spells.length).toBeGreaterThan(0)
  })

  it('renders every text of every monster with zero unresolved tags', () => {
    for (const raw of monsters) {
      const sb = parseMonster(raw)
      for (const text of allText(sb)) {
        const rendered = renderTags(text)
        expect(rendered, `${sb.name}: ${text}`).not.toContain('{@')
      }
    }
  })

  it('computes initiative bonus fallback from DEX', () => {
    const noInit = monsters.find((m) => m.initiative === undefined && (m.dex ?? 10) >= 14)
    expect(noInit).toBeDefined()
    const sb = parseMonster(noInit!)
    expect(sb.initiativeBonus).toBe(Math.floor(((noInit!.dex ?? 10) - 10) / 2))
  })
})

describe.skipIf(!hasFixtures)('parseSpell (spells fixture)', () => {
  const spells = loadFixture<{ spell: Parameters<typeof parseSpell>[0][] }>('spells/spells-xphb.json').spell

  it('parses all spells without throwing', () => {
    expect(spells.length).toBeGreaterThanOrEqual(380)
    for (const raw of spells) {
      expect(() => parseSpell(raw), raw.name).not.toThrow()
    }
  })

  it('spot-checks Fireball', () => {
    const fireball = parseSpell(spells.find((s) => s.name === 'Fireball')!)
    expect(fireball.level).toBe(3)
    expect(fireball.school).toBe('Evocation')
    expect(fireball.castingTime).toBe('1 Action')
    expect(fireball.range).toBe('150 feet')
    expect(fireball.components).toBe('V, S, M (a ball of bat guano and sulfur)')
    expect(fireball.duration).toBe('Instantaneous')
    expect(fireball.concentration).toBe(false)
    expect(fireball.higherLevel.length).toBeGreaterThan(0)
    expect(fireball.text.length).toBeGreaterThan(0)
  })

  it('renders every spell text with zero unresolved tags', () => {
    for (const raw of spells) {
      const spell = parseSpell(raw)
      for (const text of [...spell.text, ...spell.higherLevel]) {
        expect(renderTags(text), spell.name).not.toContain('{@')
      }
    }
  })
})

describe.skipIf(!hasFixtures)('parseItem (items fixtures)', () => {
  const items = loadFixture<{ item: Parameters<typeof parseItem>[0][] }>('items.json').item
  const baseItems = loadFixture<{ baseitem: Parameters<typeof parseItem>[0][] }>('items-base.json').baseitem
  const modern = [...items, ...baseItems].filter((i) => i.source === 'XPHB' || i.source === 'XDMG')

  it('parses all XPHB/XDMG items without throwing', () => {
    expect(modern.length).toBeGreaterThanOrEqual(500)
    for (const raw of modern) {
      expect(() => parseItem(raw), raw.name).not.toThrow()
    }
  })

  it('spot-checks a base weapon (Longsword)', () => {
    const raw = baseItems.find((i) => i.name === 'Longsword' && i.source === 'XPHB')
    expect(raw).toBeDefined()
    const sword = parseItem(raw!)
    expect(sword.typeName).toBe('Melee Weapon')
    expect(sword.text[0]).toContain('1d8 Slashing')
    expect(sword.text[0]).toContain('Versatile (1d10)')
  })

  it('renders every item text with zero unresolved tags', () => {
    for (const raw of modern) {
      const item = parseItem(raw)
      for (const text of item.text) {
        expect(renderTags(text), item.name).not.toContain('{@')
      }
    }
  })
})
