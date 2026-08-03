import { useReducer, type Dispatch } from 'react'
import { popReference, pushReference, type ReferenceView } from '../lib/referenceStack'

/**
 * The tracker's view state: what is selected, what the AoE bar holds, and how
 * deep into the reference drawer the DM has navigated.
 *
 * None of this is battle state — the reducer in `battleReducer.ts` remains the
 * single write path for anything persisted or broadcast, and nothing here goes
 * near it. This exists because `App.tsx` had grown to eleven `useState` calls
 * and was tipping from a composition root into a state dump, with two gestures
 * (arming AoE from a roll, changing turn) already needing three coordinated
 * setState calls each. As one reducer they are one action, and testable.
 */
export interface TrackerUiState {
  /** Manually selected combatant; null means "follow the turn". */
  selectedId: string | null
  /** Pinned combatant, which outranks both selection and the turn. */
  pinnedId: string | null
  /** AoE multi-select armed. */
  multiSelect: boolean
  checked: ReadonlySet<string>
  /** The AoE bar's amount field: arithmetic or dice notation. */
  aoeAmount: string
  /** Pushed reference views. Empty means the drawer shows the statblock floor. */
  reference: readonly ReferenceView[]
}

export const initialTrackerUi: TrackerUiState = {
  selectedId: null,
  pinnedId: null,
  multiSelect: false,
  checked: new Set(),
  aoeAmount: '',
  reference: [],
}

export type TrackerUiAction =
  | { type: 'select'; id: string }
  | { type: 'togglePin'; id: string }
  | { type: 'setMultiSelect'; on: boolean }
  | { type: 'setChecked'; checked: ReadonlySet<string> }
  | { type: 'setAoeAmount'; amount: string }
  /** A rolled total lands in the AoE bar and arms it, in one step. */
  | { type: 'sendRollToAoe'; amount: number }
  /** The active turn changed: an unpinned panel follows it again. */
  | { type: 'turnChanged' }
  | { type: 'pushReference'; view: ReferenceView }
  | { type: 'popReference' }
  | { type: 'clearReference' }

export function trackerUiReducer(state: TrackerUiState, action: TrackerUiAction): TrackerUiState {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id }

    case 'togglePin':
      return { ...state, pinnedId: state.pinnedId === action.id ? null : action.id }

    case 'setMultiSelect':
      // Leaving AoE mode drops the selection: coming back to a set of checkboxes
      // chosen for a spell three turns ago is never what was meant.
      return { ...state, multiSelect: action.on, checked: action.on ? state.checked : new Set() }

    case 'setChecked':
      return { ...state, checked: action.checked }

    case 'setAoeAmount':
      return { ...state, aoeAmount: action.amount }

    case 'sendRollToAoe':
      // Arming the bar is part of it — otherwise the number lands somewhere the
      // DM cannot see. An existing selection is kept: rolling damage for targets
      // already picked is the normal order of events.
      return {
        ...state,
        aoeAmount: String(action.amount),
        multiSelect: true,
        checked: state.multiSelect ? state.checked : new Set(),
      }

    case 'turnChanged':
      return state.selectedId === null ? state : { ...state, selectedId: null }

    case 'pushReference':
      return { ...state, reference: pushReference(state.reference, action.view) }

    case 'popReference':
      return state.reference.length === 0 ? state : { ...state, reference: popReference(state.reference) }

    case 'clearReference':
      return state.reference.length === 0 ? state : { ...state, reference: [] }
  }
}

export function useTrackerUi(): [TrackerUiState, Dispatch<TrackerUiAction>] {
  return useReducer(trackerUiReducer, initialTrackerUi)
}
