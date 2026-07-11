import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CombatDb } from '../db'
import { ensureSrdData } from './loadSrd'

const dataDir = resolve(import.meta.dirname, '..', '..', 'public', 'data')

// Serves the committed public/data files like the precached assets would be.
const fakeFetch: typeof fetch = (input) => {
  const file = String(input).split('/').pop()!
  const body = readFileSync(resolve(dataDir, file), 'utf8')
  return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'application/json' } }))
}

describe('ensureSrdData', () => {
  it('loads bundled data on first launch and skips when up to date', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      expect(await ensureSrdData(db, fakeFetch)).toBe(true)
      expect(await db.monsters.count()).toBeGreaterThan(300)
      expect(await db.spells.count()).toBeGreaterThan(300)
      expect(await db.items.count()).toBeGreaterThan(400)
      expect(await db.monsters.get('xmm-adult-red-dragon')).toBeDefined()

      // second launch with same version: no reload
      expect(await ensureSrdData(db, fakeFetch)).toBe(false)
    } finally {
      await db.delete()
    }
  })

  it('reloads when the bundled data version changes', async () => {
    const db = new CombatDb(`test-${crypto.randomUUID()}`)
    try {
      await ensureSrdData(db, fakeFetch)
      await db.meta.put({ key: 'srdDataVersion', value: 'outdated' })
      expect(await ensureSrdData(db, fakeFetch)).toBe(true)
    } finally {
      await db.delete()
    }
  })
})
