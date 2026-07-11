import { useSyncExternalStore } from 'react'
import { db } from '../db'
import {
  battleReducer,
  initialBattle,
  initialState,
  type BattleAction,
  type BattleState,
} from './battleReducer'

/**
 * Single store around the pure reducer. Change notifications go through
 * `subscribe` — the future Player View broadcaster attaches there.
 * State is persisted to Dexie (debounced) so a reload restores the battle.
 */
class BattleStore {
  private state: BattleState = initialState
  private listeners = new Set<() => void>()
  private hydrated = false
  private persistTimer: ReturnType<typeof setTimeout> | undefined

  getState = (): BattleState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch = (action: BattleAction): void => {
    const prev = this.state
    this.state = battleReducer(prev, action)
    if (this.state === prev) return
    for (const listener of this.listeners) listener()
    this.schedulePersist()
  }

  async hydrate(): Promise<void> {
    const [combatants, battle] = await Promise.all([db.combatants.toArray(), db.battle.get('current')])
    this.state = battleReducer(this.state, {
      type: 'hydrate',
      combatants,
      battle: battle ?? initialBattle,
    })
    this.hydrated = true
    for (const listener of this.listeners) listener()
  }

  private schedulePersist(): void {
    if (!this.hydrated) return
    clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      const { combatants, battle } = this.state
      db.transaction('rw', [db.combatants, db.battle], async () => {
        await db.combatants.clear()
        await db.combatants.bulkPut(combatants)
        await db.battle.put(battle)
      }).catch((err: unknown) => console.error('battle persist failed:', err))
    }, 150)
  }
}

export const battleStore = new BattleStore()

export function useBattleState(): BattleState {
  return useSyncExternalStore(battleStore.subscribe, battleStore.getState)
}
