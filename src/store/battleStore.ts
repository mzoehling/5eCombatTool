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

  /**
   * Applies several actions as one undoable step.
   *
   * Undo pops a single entry, so a gesture that dispatched N times took N
   * undos to reverse and wrote N lines into the combat log. Two of them are
   * genuinely plural: an AoE against a save sends full damage and half damage
   * separately, because the reducer applies one amount per action and each
   * group needs its own temp-HP handling; putting a selection into a group
   * assigns each member. Both are one thing the DM did, and must come back in
   * one Ctrl+Z and read as one line in the log.
   *
   * The reducer stays the only write path — this batches what reaches it, it
   * does not go around it.
   */
  dispatchAll = (actions: BattleAction[]): void => {
    const before = this.state
    const messages: string[] = []
    for (const action of actions) {
      const prev = this.state
      this.state = battleReducer(prev, action)
      if (this.state === prev) continue
      if (isUndoable(action)) messages.push(...describeAction(action, prev, this.state))
    }
    if (this.state === before) return
    if (messages.length) {
      this.past = [...this.past.slice(-(UNDO_LIMIT - 1)), before]
      // One line for one gesture: the log is the DM's record of the fight, and
      // six lines for one tap devalue it. Callers with something better to say
      // than the concatenated per-action text pass it as a single action.
      this.appendLog([messages.join(' · ')])
    }
    this.notify()
    this.schedulePersist()
  }

  /** Empties the combat log (used when clearing the tracker). */
  clearLog = (): void => {
    this.log = []
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
