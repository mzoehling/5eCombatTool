import { db } from '../db'
import type { DrawerSide } from '../lib/drawer'

/**
 * Small UI preferences that outlive a session but are not battle data.
 *
 * They live in `db.meta` like everything else the app remembers, rather than in
 * localStorage: one persistence mechanism is easier to reason about than two,
 * and the cost — Dexie is async, so the drawer's first frame uses the default
 * size before the stored one arrives — only shows if the drawer is open at
 * startup, and it never is.
 *
 * The two axes are stored separately on purpose: 30% of an iPad's width and 30%
 * of its height are not the same amount of room.
 */
const KEY: Record<DrawerSide, string> = {
  right: 'drawerSize.right',
  bottom: 'drawerSize.bottom',
}

export async function readDrawerSize(side: DrawerSide): Promise<number | null> {
  const entry = await db.meta.get(KEY[side])
  if (!entry) return null
  const size = Number.parseInt(entry.value, 10)
  return Number.isFinite(size) ? size : null
}

export async function writeDrawerSize(side: DrawerSide, size: number): Promise<void> {
  await db.meta.put({ key: KEY[side], value: String(Math.round(size)) })
}
