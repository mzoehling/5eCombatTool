import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Statblock } from '../types'
import { detectLimitedUses } from './limitedUses'
import { parseMonster } from './parser'

const fixturePath = resolve(import.meta.dirname, '..', '..', 'fixtures', 'bestiary', 'bestiary-xmm.json')
const hasFixtures = existsSync(fixturePath)

describe.skipIf(!hasFixtures)('detectLimitedUses (fixtures)', () => {
  // body still executes when skipped — guard the load itself
  const monsters = (
    hasFixtures ? JSON.parse(readFileSync(fixturePath, 'utf8')).monster : []
  ) as Parameters<typeof parseMonster>[0][]
  const byName = (name: string): Statblock => parseMonster(monsters.find((m) => m.name === name)!)

  it('detects recharge abilities and legendary actions (Adult Red Dragon)', () => {
    const limits = detectLimitedUses(byName('Adult Red Dragon'))
    const breath = limits.find((l) => l.name === 'Fire Breath')
    expect(breath).toMatchObject({ max: 1, rechargeRule: 'recharge:5' })
    const legendary = limits.find((l) => l.name === 'Legendary Actions')
    expect(legendary).toMatchObject({ max: 3, rechargeRule: 'turn' })
    const daily = limits.find((l) => l.name.startsWith('Fireball'))
    expect(daily).toMatchObject({ max: 1, rechargeRule: 'day' })
  })

  it('detects X/Day traits (Legendary Resistance)', () => {
    const limits = detectLimitedUses(byName('Lich'))
    const lr = limits.find((l) => l.name === 'Legendary Resistance')
    expect(lr).toMatchObject({ max: 4, rechargeRule: 'day' })
  })

  it('creates per-spell limits for "each" lists', () => {
    // Djinni: 2/Day Each list
    const limits = detectLimitedUses(byName('Djinni'))
    const each = limits.filter((l) => l.name.includes('2/Day Each'))
    expect(each.length).toBeGreaterThan(1)
    for (const l of each) expect(l.max).toBe(2)
  })
})
