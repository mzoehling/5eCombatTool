import { describe, expect, it } from 'vitest'
import { initialTrackerUi, trackerUiReducer, type TrackerUiState } from './trackerUi'
import type { ReferenceView } from '../lib/referenceStack'

const spell = (name: string): ReferenceView => ({ kind: 'spell', name })

function state(patch: Partial<TrackerUiState> = {}): TrackerUiState {
  return { ...initialTrackerUi, ...patch }
}

describe('trackerUiReducer — selection and pin', () => {
  it('selects a combatant', () => {
    expect(trackerUiReducer(state(), { type: 'select', id: 'a' }).selectedId).toBe('a')
  })

  it('toggles the pin off when the same combatant is pinned again', () => {
    const pinned = trackerUiReducer(state(), { type: 'togglePin', id: 'a' })
    expect(pinned.pinnedId).toBe('a')
    expect(trackerUiReducer(pinned, { type: 'togglePin', id: 'a' }).pinnedId).toBeNull()
  })

  it('moves the pin to another combatant', () => {
    const pinned = state({ pinnedId: 'a' })
    expect(trackerUiReducer(pinned, { type: 'togglePin', id: 'b' }).pinnedId).toBe('b')
  })

  it('drops manual selection when the turn changes, so the panel follows again', () => {
    expect(trackerUiReducer(state({ selectedId: 'a' }), { type: 'turnChanged' }).selectedId).toBeNull()
  })

  it('leaves the pin alone when the turn changes — that is what pinning is for', () => {
    const next = trackerUiReducer(state({ selectedId: 'a', pinnedId: 'b' }), { type: 'turnChanged' })
    expect(next.pinnedId).toBe('b')
  })

  it('returns the same object when a turn change would change nothing', () => {
    // Fires on every turn; an identity-preserving no-op keeps it from
    // re-rendering the tracker for nothing.
    const s = state()
    expect(trackerUiReducer(s, { type: 'turnChanged' })).toBe(s)
  })
})

describe('trackerUiReducer — AoE', () => {
  it('drops the selection when AoE is switched off', () => {
    // Coming back to checkboxes picked for a spell three turns ago is never
    // what was meant.
    const armed = state({ multiSelect: true, checked: new Set(['a', 'b']) })
    const off = trackerUiReducer(armed, { type: 'setMultiSelect', on: false })
    expect(off.multiSelect).toBe(false)
    expect(off.checked.size).toBe(0)
  })

  it('keeps the selection when AoE is re-armed with one already in progress', () => {
    const armed = state({ multiSelect: true, checked: new Set(['a']) })
    expect(trackerUiReducer(armed, { type: 'setMultiSelect', on: true }).checked.size).toBe(1)
  })

  it('arms the bar and fills the amount from a roll in one step', () => {
    const next = trackerUiReducer(state(), { type: 'sendRollToAoe', amount: 17 })
    expect(next).toMatchObject({ aoeAmount: '17', multiSelect: true })
    expect(next.checked.size).toBe(0)
  })

  it('keeps targets already picked when a roll is sent to an armed bar', () => {
    // Picking targets and then rolling damage for them is the normal order.
    const armed = state({ multiSelect: true, checked: new Set(['a', 'b']) })
    expect(trackerUiReducer(armed, { type: 'sendRollToAoe', amount: 9 }).checked.size).toBe(2)
  })

  it('carries the amount as text, since the field also takes dice notation', () => {
    expect(trackerUiReducer(state(), { type: 'setAoeAmount', amount: '8d6' }).aoeAmount).toBe('8d6')
  })
})

describe('trackerUiReducer — reference stack', () => {
  it('pushes and pops', () => {
    const deep = trackerUiReducer(state(), { type: 'pushReference', view: spell('Fireball') })
    expect(deep.reference).toEqual([spell('Fireball')])
    expect(trackerUiReducer(deep, { type: 'popReference' }).reference).toEqual([])
  })

  it('returns the same object when popping at the floor', () => {
    const s = state()
    expect(trackerUiReducer(s, { type: 'popReference' })).toBe(s)
    expect(trackerUiReducer(s, { type: 'clearReference' })).toBe(s)
  })

  it('clears the whole trail at once', () => {
    const deep = state({ reference: [spell('a'), spell('b'), spell('c')] })
    expect(trackerUiReducer(deep, { type: 'clearReference' }).reference).toEqual([])
  })

  it('keeps the reference trail independent of the AoE bar', () => {
    // The two are unrelated: reading a spell mid-AoE must not disarm the bar.
    const s = state({ multiSelect: true, checked: new Set(['a']), aoeAmount: '12' })
    const next = trackerUiReducer(s, { type: 'pushReference', view: spell('Fireball') })
    expect(next).toMatchObject({ multiSelect: true, aoeAmount: '12' })
    expect(next.checked.size).toBe(1)
  })
})
