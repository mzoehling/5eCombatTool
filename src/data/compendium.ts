import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Item, Spell, Statblock } from '../types'

export type Origin = { kind: 'srd' } | { kind: 'pack'; packName: string } | { kind: 'homebrew'; isPC: boolean }

export interface CompendiumEntry<T> {
  entry: T
  origin: Origin
}

export interface CompendiumData {
  monsters: CompendiumEntry<Statblock>[]
  spells: CompendiumEntry<Spell>[]
  items: CompendiumEntry<Item>[]
}

/** Live view over SRD tables + imported packs + homebrew. */
export function useCompendium(): CompendiumData | undefined {
  return useLiveQuery(async (): Promise<CompendiumData> => {
    const [monsters, spells, items, packs, homebrew] = await Promise.all([
      db.monsters.toArray(),
      db.spells.toArray(),
      db.items.toArray(),
      db.packs.toArray(),
      db.homebrew.toArray(),
    ])
    const srd = { kind: 'srd' } as const
    const data: CompendiumData = {
      monsters: monsters.map((entry) => ({ entry, origin: srd })),
      spells: spells.map((entry) => ({ entry, origin: srd })),
      items: items.map((entry) => ({ entry, origin: srd })),
    }
    for (const pack of packs) {
      const origin = { kind: 'pack', packName: pack.name } as const
      data.monsters.push(...(pack.monsters ?? []).map((entry) => ({ entry, origin })))
      data.spells.push(...(pack.spells ?? []).map((entry) => ({ entry, origin })))
      data.items.push(...(pack.items ?? []).map((entry) => ({ entry, origin })))
    }
    for (const hb of homebrew) {
      data.monsters.push({ entry: hb.statblock, origin: { kind: 'homebrew', isPC: hb.kind === 'pc' } })
    }
    return data
  })
}

/** Case-insensitive spell lookup: SRD table first, then imported packs. */
export async function findSpellByName(name: string): Promise<Spell | undefined> {
  const trimmed = name.trim()
  const srd = await db.spells.where('name').equalsIgnoreCase(trimmed).first()
  if (srd) return srd
  const lower = trimmed.toLowerCase()
  const packs = await db.packs.toArray()
  for (const pack of packs) {
    const hit = (pack.spells ?? []).find((s) => s.name.toLowerCase() === lower)
    if (hit) return hit
  }
  return undefined
}
