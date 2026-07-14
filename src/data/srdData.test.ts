import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Item, Rule, Spell, Statblock } from '../types'

const root = resolve(import.meta.dirname, '..', '..')
const fixturesDir = resolve(root, 'fixtures')
const dataDir = resolve(root, 'public', 'data')
const hasFixtures = existsSync(resolve(fixturesDir, 'bestiary', 'bestiary-xmm.json'))

function load<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

// Expected SRD 5.2 coverage. ±10% tolerance: upstream changes should be
// noticed (test fails) without hard-failing on every small addition.
// `rules` merges variantrules + actions + senses + skills + conditions +
// statuses (minus Concentration, tracked separately — see build-srd.ts).
const EXPECTED = { monsters: 331, spells: 339, items: 474, baseItems: 92, rules: 168 }

function expectWithinTolerance(actual: number, expected: number, label: string) {
  expect(actual, `${label}: ${actual} vs expected ${expected} ±10%`).toBeGreaterThanOrEqual(expected * 0.9)
  expect(actual, `${label}: ${actual} vs expected ${expected} ±10%`).toBeLessThanOrEqual(expected * 1.1)
}

describe.skipIf(!hasFixtures)('srd52 coverage in upstream fixtures', () => {
  it('matches the expected monster/spell/item counts (±10%)', () => {
    const srd = (arr: { srd52?: boolean | string }[]) => arr.filter((e) => e.srd52).length
    const monsters = load<{ monster: { srd52?: boolean }[] }>(resolve(fixturesDir, 'bestiary/bestiary-xmm.json'))
    const spells = load<{ spell: { srd52?: boolean }[] }>(resolve(fixturesDir, 'spells/spells-xphb.json'))
    const items = load<{ item: { srd52?: boolean }[] }>(resolve(fixturesDir, 'items.json'))
    const base = load<{ baseitem: { srd52?: boolean }[] }>(resolve(fixturesDir, 'items-base.json'))
    const variantrules = load<{ variantrule: { srd52?: boolean }[] }>(resolve(fixturesDir, 'variantrules.json'))
    const actions = load<{ action: { srd52?: boolean }[] }>(resolve(fixturesDir, 'actions.json'))
    const senses = load<{ sense: { srd52?: boolean }[] }>(resolve(fixturesDir, 'senses.json'))
    const skills = load<{ skill: { srd52?: boolean }[] }>(resolve(fixturesDir, 'skills.json'))
    const conditions = load<{ condition: { srd52?: boolean }[]; status: { srd52?: boolean; name: string }[] }>(
      resolve(fixturesDir, 'conditionsdiseases.json'),
    )

    expectWithinTolerance(srd(monsters.monster), EXPECTED.monsters, 'monsters')
    expectWithinTolerance(srd(spells.spell), EXPECTED.spells, 'spells')
    expectWithinTolerance(srd(items.item), EXPECTED.items, 'items')
    expectWithinTolerance(srd(base.baseitem), EXPECTED.baseItems, 'base items')

    const rulesTotal =
      srd(variantrules.variantrule) +
      srd(actions.action) +
      srd(senses.sense) +
      srd(skills.skill) +
      srd(conditions.condition) +
      conditions.status.filter((s) => s.srd52 && s.name !== 'Concentration').length
    expectWithinTolerance(rulesTotal, EXPECTED.rules, 'rules')
  })
})

describe('committed SRD data (public/data)', () => {
  it('exists and matches its meta counts', () => {
    const meta = load<{ version: string; counts: typeof EXPECTED }>(resolve(dataDir, 'srd-meta.json'))
    const monsters = load<Statblock[]>(resolve(dataDir, 'srd-monsters.json'))
    const spells = load<Spell[]>(resolve(dataDir, 'srd-spells.json'))
    const items = load<Item[]>(resolve(dataDir, 'srd-items.json'))
    const rules = load<Rule[]>(resolve(dataDir, 'srd-rules.json'))

    expect(meta.version).toMatch(/^[0-9a-f]{16}$/)
    expect(monsters.length).toBe(meta.counts.monsters)
    expect(spells.length).toBe(meta.counts.spells)
    expect(items.length).toBe(meta.counts.items + meta.counts.baseItems)
    expect(rules.length).toBe(meta.counts.rules)

    expectWithinTolerance(monsters.length, EXPECTED.monsters, 'bundled monsters')
    expectWithinTolerance(spells.length, EXPECTED.spells, 'bundled spells')
    expectWithinTolerance(rules.length, EXPECTED.rules, 'bundled rules')
  })

  it('includes the merged action/sense/skill/condition/status glossary entries', () => {
    const rules = load<Rule[]>(resolve(dataDir, 'srd-rules.json'))
    const names = new Set(rules.map((r) => r.name))
    for (const name of ['Attack', 'Blindsight', 'Acrobatics', 'Blinded', 'Bloodied', 'Surprised']) {
      expect(names.has(name), name).toBe(true)
    }
    expect(names.has('Concentration')).toBe(false)
  })

  it('contains normalized statblocks with computed initiative', () => {
    const monsters = load<Statblock[]>(resolve(dataDir, 'srd-monsters.json'))
    const dragon = monsters.find((m) => m.name === 'Adult Red Dragon')
    expect(dragon).toBeDefined()
    expect(dragon!.initiativeBonus).toBe(12)
    expect(dragon!.hp.average).toBe(256)
    for (const m of monsters) {
      expect(typeof m.initiativeBonus, m.name).toBe('number')
      expect(m.hp.average, m.name).toBeGreaterThanOrEqual(0)
    }
  })
})
