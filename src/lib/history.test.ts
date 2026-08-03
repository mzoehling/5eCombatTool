import { describe, expect, it } from 'vitest'
import { historySteps } from './history'
import type { LogEntry } from '../store/battleStore'

function line(step: number, message: string, extra: Partial<LogEntry> = {}): LogEntry {
  return { at: 1_000 + step, round: 1, message, step, ...extra }
}

describe('historySteps', () => {
  it('reads newest first', () => {
    const steps = historySteps([line(1, 'first'), line(2, 'second')], { undoableStep: 2, preReloadStep: -1 })
    expect(steps.map((s) => s.step)).toEqual([2, 1])
  })

  it('keeps the several lines of one dispatch as one step', () => {
    // Damage plus its concentration note is one thing the DM did.
    const log = [line(1, 'Goblin takes 7 damage'), line(1, 'Goblin must hold Concentration')]
    const steps = historySteps(log, { undoableStep: 1, preReloadStep: -1 })
    expect(steps).toHaveLength(1)
    expect(steps[0].entries.map((e) => e.message)).toEqual([
      'Goblin takes 7 damage',
      'Goblin must hold Concentration',
    ])
  })

  it('puts the undo icon on the step, not on each of its lines', () => {
    const log = [line(1, 'a'), line(2, 'b'), line(2, 'c')]
    const steps = historySteps(log, { undoableStep: 2, preReloadStep: -1 })
    expect(steps[0].undoable).toBe(true)
    expect(steps[0].entries).toHaveLength(2)
    expect(steps[1].undoable).toBe(false)
  })

  it('offers undo only on the newest step', () => {
    const steps = historySteps([line(1, 'a'), line(2, 'b'), line(3, 'c')], {
      undoableStep: 3,
      preReloadStep: -1,
    })
    expect(steps.filter((s) => s.undoable)).toHaveLength(1)
  })

  it('offers nothing when the undo stack is empty', () => {
    const steps = historySteps([line(1, 'a')], { undoableStep: null, preReloadStep: -1 })
    expect(steps.every((s) => !s.undoable)).toBe(true)
  })

  it('does not offer undo on an already-reverted step', () => {
    // Undo pops the stack, so this pairing should not occur — but a stale
    // `undoableStep` must not produce an icon that would reverse it twice.
    const steps = historySteps([line(1, 'a', { reverted: true })], { undoableStep: 1, preReloadStep: -1 })
    expect(steps[0].undoable).toBe(false)
    expect(steps[0].reverted).toBe(true)
  })

  it('moves the icon down to the next step after an undo, so undo repeats', () => {
    // The bug this covers: the icon was anchored to the newest step outright,
    // which after an undo is the struck-through one — so it vanished and undo
    // looked like a once-per-session action.
    const log = [line(1, 'a'), line(2, 'b'), line(3, 'c', { reverted: true })]
    const steps = historySteps(log, { undoableStep: 2, preReloadStep: -1 })
    expect(steps.map((s) => [s.step, s.undoable])).toEqual([
      [3, false],
      [2, true],
      [1, false],
    ])
  })

  it('keeps walking down as undo is repeated', () => {
    const log = [line(1, 'a'), line(2, 'b', { reverted: true }), line(3, 'c', { reverted: true })]
    const steps = historySteps(log, { undoableStep: 1, preReloadStep: -1 })
    expect(steps.find((s) => s.undoable)?.step).toBe(1)
  })

  it('offers nothing once every step has been undone', () => {
    const log = [line(1, 'a', { reverted: true }), line(2, 'b', { reverted: true })]
    const steps = historySteps(log, { undoableStep: null, preReloadStep: -1 })
    expect(steps.every((s) => !s.undoable)).toBe(true)
  })

  it('does not offer undo on a reverted step even when it is the stack top', () => {
    // Reverted lines from before a reload can outlive the stack that made them,
    // so a step can be both reverted and named by a stale `undoableStep`.
    const log = [line(1, 'a'), line(2, 'b', { reverted: true })]
    const steps = historySteps(log, { undoableStep: 2, preReloadStep: -1 })
    expect(steps.every((s) => !s.undoable)).toBe(true)
  })

  it('marks the boundary above the newest step that predates the reload', () => {
    const log = [line(1, 'old'), line(2, 'old too'), line(3, 'after reload')]
    const steps = historySteps(log, { undoableStep: 3, preReloadStep: 2 })
    expect(steps.map((s) => s.firstBeforeReload)).toEqual([false, true, false])
  })

  it('marks the boundary even when everything predates the reload', () => {
    // Right after a reload nothing is undoable; the divider is what explains it.
    const steps = historySteps([line(1, 'old'), line(2, 'old too')], {
      undoableStep: null,
      preReloadStep: 2,
    })
    expect(steps[0].firstBeforeReload).toBe(true)
  })

  it('draws no boundary in a session that was never reloaded', () => {
    const steps = historySteps([line(0, 'a'), line(1, 'b')], { undoableStep: 1, preReloadStep: -1 })
    expect(steps.every((s) => !s.firstBeforeReload)).toBe(true)
  })

  it('dates a step by its last line, so it reads as when the gesture finished', () => {
    const log = [
      { at: 100, round: 2, message: 'a', step: 5 },
      { at: 180, round: 2, message: 'b', step: 5 },
    ]
    expect(historySteps(log, { undoableStep: 5, preReloadStep: -1 })[0].at).toBe(180)
  })

  it('handles an empty log', () => {
    expect(historySteps([], { undoableStep: null, preReloadStep: -1 })).toEqual([])
  })
})
