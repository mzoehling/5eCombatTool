import type { CombatDb } from '../db'
import { db } from '../db'

/** Clears the bundled SRD tables and version marker, forcing a refetch on next load. */
export async function clearSrdCache(dbi: CombatDb = db): Promise<void> {
  await dbi.transaction('rw', [dbi.monsters, dbi.spells, dbi.items, dbi.rules, dbi.meta], async () => {
    await Promise.all([dbi.monsters.clear(), dbi.spells.clear(), dbi.items.clear(), dbi.rules.clear()])
    await dbi.meta.delete('srdDataVersion')
  })
}

/**
 * Clears the SRD cache, drops the service worker and its CacheStorage
 * entries, and reloads — a manual escape hatch for a stuck offline cache.
 * Homebrew, packs, saved encounters and the running battle are untouched.
 */
export async function clearCacheAndReload(dbi: CombatDb = db): Promise<void> {
  await clearSrdCache(dbi)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
  location.reload()
}
