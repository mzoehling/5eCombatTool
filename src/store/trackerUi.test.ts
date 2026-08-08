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
    // Applying leaves this way too, so nothing may survive: targets picked for a
    // spell three turns ago, that spell's damage number, and above all a factor
    // — a ×½ left behind would silently halve the next fireball.
    const armed = state({
      multiSelect: true,
      checked: new Set(['a', 'b']),
      aoeAmount: '8d6',
      aoeStep: 'apply',
      aoeSaveAbility: 'dex',
      aoeSaveDc: '15',
      aoeResults: { a: { total: 19, verdict: 'saved' } },
      aoeFactors: { a: 0.5 },
    })
    const out = trackerUiReducer(armed, { type: 'exitAoe' })
    expect(out).toMatchObject({
      multiSelect: false,
      aoeAmount: '',
      aoeStep: 'select',
      aoeSaveAbility: null,
      aoeSaveDc: '',
      aoeResults: {},
      aoeFactors: {},
    })
    expect(out.checked.size).toBe(0)
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

describe('trackerUiReducer — the AoE stepper', () => {
  const armed = (patch: Partial<TrackerUiState> = {}) =>
    state({ multiSelect: true, checked: new Set(['a', 'b']), ...patch })

  it('arms at step one with nothing carried over', () => {
    expect(trackerUiReducer(state(), { type: 'armAoe' })).toMatchObject({
      multiSelect: true,
      aoeStep: 'select',
      aoeFactors: {},
      aoeResults: {},
    })
  })

  it('walks forward and back a step at a time', () => {
    const onSave = trackerUiReducer(armed(), { type: 'setAoeStep', step: 'save' })
    expect(onSave.aoeStep).toBe('save')
    expect(trackerUiReducer(onSave, { type: 'setAoeStep', step: 'select' }).aoeStep).toBe('select')
  })

  it('seeds ½ on a made save and ×1 on a failed one, on reaching Apply', () => {
    const s = armed({
      aoeResults: { a: { total: 19, verdict: 'saved' }, b: { total: 6, verdict: 'failed' } },
    })
    expect(trackerUiReducer(s, { type: 'setAoeStep', step: 'apply' }).aoeFactors).toEqual({ a: 0.5, b: 1 })
  })

  it('seeds ×1 for a target with no result at all — the No save path', () => {
    expect(trackerUiReducer(armed(), { type: 'setAoeStep', step: 'apply' }).aoeFactors).toEqual({ a: 1, b: 1 })
  })

  it('seeds only the checked targets', () => {
    const s = state({ multiSelect: true, checked: new Set(['a']) })
    expect(trackerUiReducer(s, { type: 'setAoeStep', step: 'apply' }).aoeFactors).toEqual({ a: 1 })
  })

  it('does not seed on the way to Select or Save', () => {
    expect(trackerUiReducer(armed(), { type: 'setAoeStep', step: 'save' }).aoeFactors).toEqual({})
  })

  it('leaves a hand-set factor alone when Apply is reached again', () => {
    // Stepping back to check a roll and forward again must not quietly undo the
    // DM's own answer about a row.
    const s = armed({ aoeFactors: { a: 2 }, aoeResults: { a: { total: 19, verdict: 'saved' } } })
    expect(trackerUiReducer(s, { type: 'setAoeStep', step: 'apply' }).aoeFactors).toMatchObject({ a: 2 })
  })

  it('sets a factor for one row without touching the others', () => {
    const s = armed({ aoeFactors: { a: 1, b: 1 } })
    expect(trackerUiReducer(s, { type: 'setAoeFactor', id: 'b', factor: 0 }).aoeFactors).toEqual({ a: 1, b: 0 })
  })

  it('takes ability and DC independently, so setting one keeps the other', () => {
    const withAbility = trackerUiReducer(armed(), { type: 'setAoeSave', ability: 'dex' })
    const withDc = trackerUiReducer(withAbility, { type: 'setAoeSave', dc: '15' })
    expect(withDc).toMatchObject({ aoeSaveAbility: 'dex', aoeSaveDc: '15' })
  })

  it('drops results and factors when the ability or DC changes', () => {
    // Every roll was read against the old DC, and a factor seeded from a stale
    // verdict is a wrong number wearing the DM's handwriting.
    const s = armed({
      aoeSaveDc: '15',
      aoeResults: { a: { total: 19, verdict: 'saved' } },
      aoeFactors: { a: 0.5 },
    })
    expect(trackerUiReducer(s, { type: 'setAoeSave', dc: '18' })).toMatchObject({
      aoeSaveDc: '18',
      aoeResults: {},
      aoeFactors: {},
    })
  })

  it('clears the factors on a fresh roll, so Apply seeds from what was just rolled', () => {
    const s = armed({ aoeFactors: { a: 2 } })
    const rolled = trackerUiReducer(s, {
      type: 'setAoeResults',
      results: { a: { total: 6, verdict: 'failed' } },
    })
    expect(rolled.aoeFactors).toEqual({})
    expect(rolled.aoeResults.a.verdict).toBe('failed')
  })

  it('flips one result and drops the factor seeded from it', () => {
    const s = armed({
      aoeResults: { a: { total: 19, verdict: 'saved' }, b: { total: 6, verdict: 'failed' } },
      aoeFactors: { a: 0.5, b: 1 },
    })
    const flipped = trackerUiReducer(s, { type: 'flipAoeResult', id: 'a' })
    expect(flipped.aoeResults.a).toEqual({ total: 19, verdict: 'failed' })
    expect(flipped.aoeResults.b.verdict).toBe('failed')
    expect(flipped.aoeFactors).toEqual({ b: 1 })
    // Re-seeded from the flipped verdict on the way into Apply.
    expect(trackerUiReducer(flipped, { type: 'setAoeStep', step: 'apply' }).aoeFactors).toEqual({ a: 1, b: 1 })
  })

  it('ignores a flip for a target that never rolled', () => {
    const s = armed()
    expect(trackerUiReducer(s, { type: 'flipAoeResult', id: 'a' })).toBe(s)
  })
})
