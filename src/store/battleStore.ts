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
  /**
   * The dispatch that wrote this line. One dispatch can write several lines
   * (damage plus a concentration note), and undo works on whole dispatches, so
   * the History view needs to know which lines belong together — see
   * `lib/history.ts`.
   */
  step: number
  /** Set when this step was undone. The line stays as a record of what the DM
   *  did, shown struck through, rather than being deleted from the log. */
  reverted?: boolean
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
/** One entry of the undo stack: the state to go back to, and the log step that
 *  produced it, so undoing can strike the right lines through. */
interface UndoEntry {
  state: BattleState
  step: number
}

class BattleStore {
  private state: BattleState = initialState
  private past: UndoEntry[] = []
  private log: LogEntry[] = []
  private listeners = new Set<() => void>()
  private hydrated = false
  private persistTimer: ReturnType<typeof setTimeout> | undefined
  /** Monotonic dispatch counter, stamped onto every log line. */
  private step = 0
  /** Highest step restored from storage — everything at or below it predates
   *  the last reload and can no longer be undone. */
  private preReloadStep = -1

  getState = (): BattleState => this.state

  getLog = (): LogEntry[] => this.log

  undoDepth = (): number => this.past.length

  /** The step undo would reverse, or null when there is nothing to reverse. */
  undoableStep = (): number | null => this.past.at(-1)?.step ?? null

  reloadBoundary = (): number => this.preReloadStep

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch = (action: BattleAction): void => {
    const prev = this.state
    this.state = battleReducer(prev, action)
    if (this.state === prev) return
    if (isUndoable(action)) {
      const step = ++this.step
      this.past = [...this.past.slice(-(UNDO_LIMIT - 1)), { state: prev, step }]
      this.appendLog(describeAction(action, prev, this.state), step)
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
      const step = ++this.step
      this.past = [...this.past.slice(-(UNDO_LIMIT - 1)), { state: before, step }]
      // One line for one gesture: the log is the DM's record of the fight, and
      // six lines for one tap devalue it. Callers with something better to say
      // than the concatenated per-action text pass it as a single action.
      this.appendLog([messages.join(' · ')], step)
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

  /**
   * Reverts the last undoable action (turn changes, damage, conditions, …).
   *
   * The undone lines are struck through in place rather than answered with an
   * "Undid the last change" line of their own. That line used to become the
   * newest entry in the log — and being un-undoable itself, it left the History
   * view with a top entry that could not carry the undo icon.
   */
  undo = (): void => {
    const entry = this.past.at(-1)
    if (!entry) return
    this.past = this.past.slice(0, -1)
    this.state = entry.state
    this.log = this.log.map((line) => (line.step === entry.step ? { ...line, reverted: true } : line))
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
    // A restored log outlives the undo stack, which is memory-only. Stamping the
    // restored lines (logs written before steps existed have none) and recording
    // where they end lets the History view draw the "before reloading" boundary
    // instead of just showing entries that mysteriously cannot be undone.
    this.log = this.log.map((line, i) => (typeof line.step === 'number' ? line : { ...line, step: i }))
    this.step = this.log.reduce((max, line) => Math.max(max, line.step), -1)
    this.preReloadStep = this.step
    this.past = []
    this.hydrated = true
    this.notify()
  }

  private appendLog(messages: string[], step: number): void {
    if (!messages.length) return
    const at = Date.now()
    const round = this.state.battle.round
    this.log = [...this.log, ...messages.map((message) => ({ at, round, message, step }))].slice(-LOG_LIMIT)
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

/** The step undo would reverse — what the History view puts the icon on. */
export function useUndoableStep(): number | null {
  return useSyncExternalStore(battleStore.subscribe, battleStore.undoableStep)
}

export function useReloadBoundary(): number {
  return useSyncExternalStore(battleStore.subscribe, battleStore.reloadBoundary)
}
