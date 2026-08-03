/**
 * Turns the flat combat log into the grouped view the History popover shows.
 *
 * Two facts about the store shape this: one dispatch can write several log
 * lines (damage plus a concentration note), and undo is a linear stack of whole
 * snapshots. There is no mapping from an arbitrary line back to a snapshot, so
 * only the newest step can be reversed — and the icon belongs on the *step*,
 * not on its topmost line.
 *
 * After a reload the log survives but the snapshot stack does not, so nothing
 * older than the reload is undoable. The popover has to show that boundary,
 * otherwise a full list with no undo icon anywhere reads as broken.
 */

import type { LogEntry } from '../store/battleStore'

export interface HistoryStep {
  /** The dispatch that produced these lines. */
  step: number
  /** In log order (oldest first within the step). */
  entries: LogEntry[]
  round: number
  at: number
  /** Only ever true for the newest step, and never after a reload. */
  undoable: boolean
  /** Already undone: kept as a record, shown struck through. */
  reverted: boolean
  /** This step is the newest one predating the last reload — the divider goes
   *  above it, since the list reads newest first. */
  firstBeforeReload: boolean
}

export interface HistoryInput {
  /** The step that undo would reverse, or null when the stack is empty. */
  undoableStep: number | null
  /** Highest step number restored from storage; steps at or below it predate
   *  the reload. -1 when nothing was restored. */
  preReloadStep: number
}

/**
 * Groups the log into steps, newest first. Consecutive lines sharing a step
 * number are one gesture. (Restored logs are stamped with step numbers when
 * they are hydrated, so every line has one by the time it gets here.)
 */
export function historySteps(log: readonly LogEntry[], input: HistoryInput): HistoryStep[] {
  const groups: HistoryStep[] = []
  for (const entry of log) {
    const last = groups.at(-1)
    if (last && last.step === entry.step) {
      last.entries.push(entry)
      // A step's timestamp is its latest line, so it reads as when it finished.
      last.at = entry.at
      continue
    }
    groups.push({
      step: entry.step,
      entries: [entry],
      round: entry.round,
      at: entry.at,
      undoable: false,
      reverted: entry.reverted === true,
      firstBeforeReload: false,
    })
  }
  groups.reverse()

  // The icon goes on the newest step that has *not* already been reverted, not
  // on the newest step outright: after an undo the topmost group is the struck-
  // through one, and anchoring to it stopped the icon appearing at all, so undo
  // looked like a once-per-session action. Undo is a stack, so walking past the
  // reverted steps lands exactly on what the store would pop next — which the
  // `undoableStep` check then confirms rather than assumes.
  const target = groups.find((g) => !g.reverted)
  if (target && input.undoableStep !== null && target.step === input.undoableStep) {
    target.undoable = true
  }

  // Newest first, so the first group at or below the boundary is the one the
  // divider sits above. It is marked even when it is the topmost group: the
  // divider is what explains why nothing in the list can be undone.
  const boundary = groups.find((g) => g.step <= input.preReloadStep)
  if (boundary) boundary.firstBeforeReload = true

  return groups
}
