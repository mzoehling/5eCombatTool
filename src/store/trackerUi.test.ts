import { describe, expect, it } from 'vitest'
import { initialTrackerUi, trackerUiReducer, type TrackerUiState } from './trackerUi'

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
    expect(trackerUiReducer(state({ pinnedId: 'a' }), { type: 'togglePin', id: 'b' }).pinnedId).toBe('b')
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
  it('resets the bar completely on the way out', () => {
    // "Done" is the only way out now that the bar has no Clear button, so it has
    // to leave nothing behind: targets picked for a spell three turns ago and a
    // damage number from that spell are both wrong on the way back in.
    const armed = state({ multiSelect: true, checked: new Set(['a', 'b']), aoeAmount: '8d6' })
    expect(trackerUiReducer(armed, { type: 'exitAoe' })).toMatchObject({
      multiSelect: false,
      aoeAmount: '',
    })
    expect(trackerUiReducer(armed, { type: 'exitAoe' }).checked.size).toBe(0)
  })

  it('keeps the selection when AoE is re-armed with one already in progress', () => {
    const armed = state({ multiSelect: true, checked: new Set(['a']) })
    expect(trackerUiReducer(armed, { type: 'armAoe' }).checked.size).toBe(1)
  })

  it('returns the same object when arming an already-armed bar', () => {
    const armed = state({ multiSelect: true })
    expect(trackerUiReducer(armed, { type: 'armAoe' })).toBe(armed)
  })

  it('leaves selection and pin alone on the way out of AoE', () => {
    const armed = state({ multiSelect: true, selectedId: 'a', pinnedId: 'b' })
    expect(trackerUiReducer(armed, { type: 'exitAoe' })).toMatchObject({ selectedId: 'a', pinnedId: 'b' })
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

  it('leaves selection and pin alone when the AoE bar changes', () => {
    const s = state({ selectedId: 'a', pinnedId: 'b' })
    const next = trackerUiReducer(s, { type: 'sendRollToAoe', amount: 4 })
    expect(next).toMatchObject({ selectedId: 'a', pinnedId: 'b' })
  })
})
