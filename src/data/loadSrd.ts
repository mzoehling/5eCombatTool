import type { CombatDb } from '../db'
import { db } from '../db'
import type { Item, Spell, Statblock } from '../types'

interface SrdMeta {
  version: string
}

/**
 * Loads the bundled SRD data into Dexie on first launch or when the bundled
 * data version changes. The JSON assets are precached by the service worker,
 * so this works offline from the very first start.
 */
export async function ensureSrdData(dbi: CombatDb = db, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const base = `${import.meta.env.BASE_URL}data/`
  const meta = (await (await fetchFn(`${base}srd-meta.json`)).json()) as SrdMeta
  const current = await dbi.meta.get('srdDataVersion')
  if (current?.value === meta.version) return false

  const [monsters, spells, items] = (await Promise.all([
    fetchFn(`${base}srd-monsters.json`).then((r) => r.json()),
    fetchFn(`${base}srd-spells.json`).then((r) => r.json()),
    fetchFn(`${base}srd-items.json`).then((r) => r.json()),
  ])) as [Statblock[], Spell[], Item[]]

  await dbi.transaction('rw', [dbi.monsters, dbi.spells, dbi.items, dbi.meta], async () => {
    await Promise.all([dbi.monsters.clear(), dbi.spells.clear(), dbi.items.clear()])
    await Promise.all([dbi.monsters.bulkPut(monsters), dbi.spells.bulkPut(spells), dbi.items.bulkPut(items)])
    await dbi.meta.put({ key: 'srdDataVersion', value: meta.version })
  })
  return true
}
