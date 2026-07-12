import { useSyncExternalStore } from 'react'
import { db } from '../db'
import {
  battleReducer,
  initialBattle,
  initialState,
  type BattleAction,
  type BattleState,
} from './battleReducer'
import { describeAction } from './logMessages'

export interface LogEntry {
  /** Epoch ms. */
  at: number
  round: number
  message: string
}

const UNDO_LIMIT = 50
const LOG_LIMIT = 200
const LOG_META_KEY = 'combatLog'

/** Actions that don't represent a user-visible change worth undoing. */
function isUndoable(action: BattleAction): boolean {
  return action.type !== 'hydrate' && action.type !== 'clearExpiredNotice'
}

/**
 * Single store around the pure reducer. Change notifications go through
 * `subscribe` — the Player View broadcaster attaches there. State is
 * persisted to Dexie (debounced) so a reload restores the battle; the
 * combat log persists alongside it. Undo keeps the last states in memory.
 */
class BattleStore {
  private state: BattleState = initialState
  private past: BattleState[] = []
  private log: LogEntry[] = []
  private listeners = new Set<() => void>()
  private hydrated = false
  private persistTimer: ReturnType<typeof setTimeout> | undefined

  getState = (): BattleState => this.state

  getLog = (): LogEntry[] => this.log

  undoDepth = (): number => this.past.length

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch = (action: BattleAction): void => {
    const prev = this.state
    this.state = battleReducer(prev, action)
    if (this.state === prev) return
    if (isUndoable(action)) {
      this.past = [...this.past.slice(-(UNDO_LIMIT - 1)), prev]
      this.appendLog(describeAction(action, prev, this.state))
    }
    this.notify()
    this.schedulePersist()
  }

  /** Reverts the last undoable action (turn changes, damage, conditions, …). */
  undo = (): void => {
    const prev = this.past.at(-1)
    if (!prev) return
    this.past = this.past.slice(0, -1)
    this.state = prev
    this.appendLog(['Undid the last change'])
    this.notify()
    this.schedulePersist()
  }

  async hydrate(): Promise<void> {
    const [combatants, battle, logMeta] = await Promise.all([
      db.combatants.toArray(),
      db.battle.get('current'),
      db.meta.get(LOG_META_KEY),
    ])
    this.state = battleReducer(this.state, {
      type: 'hydrate',
      combatants,
      battle: battle ?? initialBattle,
    })
    if (logMeta) {
      try {
        this.log = JSON.parse(logMeta.value) as LogEntry[]
      } catch {
        this.log = []
      }
    }
    this.past = []
    this.hydrated = true
    this.notify()
  }

  private appendLog(messages: string[]): void {
    if (!messages.length) return
    const at = Date.now()
    const round = this.state.battle.round
    this.log = [...this.log, ...messages.map((message) => ({ at, round, message }))].slice(-LOG_LIMIT)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private schedulePersist(): void {
    if (!this.hydrated) return
    clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      const { combatants, battle } = this.state
      const log = this.log
      db.transaction('rw', [db.combatants, db.battle, db.meta], async () => {
        await db.combatants.clear()
        await db.combatants.bulkPut(combatants)
        await db.battle.put(battle)
        await db.meta.put({ key: LOG_META_KEY, value: JSON.stringify(log) })
      }).catch((err: unknown) => console.error('battle persist failed:', err))
    }, 150)
  }
}

export const battleStore = new BattleStore()

export function useBattleState(): BattleState {
  return useSyncExternalStore(battleStore.subscribe, battleStore.getState)
}

export function useUndoDepth(): number {
  return useSyncExternalStore(battleStore.subscribe, battleStore.undoDepth)
}

export function useCombatLog(): LogEntry[] {
  return useSyncExternalStore(battleStore.subscribe, battleStore.getLog)
}
