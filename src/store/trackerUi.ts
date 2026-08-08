import { useReducer, type Dispatch } from 'react'
import type { SaveVerdict } from '../lib/saves'
import type { Ability } from '../types'

/**
 * The tracker's view state: what is selected, and what the AoE bar holds.
 *
 * None of this is battle state — the reducer in `battleReducer.ts` remains the
 * single write path for anything persisted or broadcast, and nothing here goes
 * near it. This exists because `App.tsx` had grown to eleven `useState` calls
 * and was tipping from a composition root into a state dump, with two gestures
 * (arming AoE from a roll, changing turn) already needing several coordinated
 * setState calls each. As one reducer they are one action, and testable.
 */
/**
 * The AoE bar walks three steps, and each one carries a single decision's worth
 * of controls.
 *
 * The bar used to hold all of them at once — the selection count, the amount,
 * Damage, Heal, Condition…, Group…, an ability select, a DC field and Roll
 * saves — which is four unrelated questions in one strip, none of them
 * announcing which came first. Split up, the order is the order the DM actually
 * works in: who is caught, how they rolled, what it does to them.
 */
export type AoeStep = 'select' | 'save' | 'apply'

/**
 * What a target's damage is multiplied by.
 *
 * Not just half-on-a-save: resistance, vulnerability and immunity are the same
 * kind of adjustment, and they are per creature. Offering all five as one tap
 * is what lets the DM answer "the fire genasi is immune" without leaving the
 * bar or doing the arithmetic in their head.
 */
export type AoeFactor = 0 | 0.25 | 0.5 | 1 | 2

/** One target's saving throw: what it rolled, and how that read against the DC. */
export interface AoeResult {
  total: number
  verdict: SaveVerdict
}

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
  /** Which of the three AoE steps the bar is showing. */
  aoeStep: AoeStep
  /** The save helper's ability and DC, owned by step 2. */
  aoeSaveAbility: Ability | null
  aoeSaveDc: string
  /** Per target, keyed by combatant id. Hand-flippable — see `flipAoeResult`. */
  aoeResults: Readonly<Record<string, AoeResult>>
  /** Per target. Seeded from the results on reaching step 3, then the DM's. */
  aoeFactors: Readonly<Record<string, AoeFactor>>
}

export const initialTrackerUi: TrackerUiState = {
  selectedId: null,
  pinnedId: null,
  multiSelect: false,
  checked: new Set(),
  aoeAmount: '',
  aoeStep: 'select',
  aoeSaveAbility: null,
  aoeSaveDc: '',
  aoeResults: {},
  aoeFactors: {},
}

/** Everything the AoE bar holds, back to the state it is armed in. */
const CLEARED_AOE = {
  checked: new Set<string>(),
  aoeAmount: '',
  aoeStep: 'select' as AoeStep,
  aoeSaveAbility: null,
  aoeSaveDc: '',
  aoeResults: {},
  aoeFactors: {},
}

/**
 * The factor each target starts step 3 on: half on a made save, full on a
 * failed one — and full for a target with no result at all, which is the "No
 * save" path through the bar.
 *
 * Only the targets that have no factor yet are seeded. One the DM has already
 * set by hand is their answer, and stepping back to check a roll and forward
 * again must not quietly undo it.
 */
function seedFactors(state: TrackerUiState): Readonly<Record<string, AoeFactor>> {
  const next: Record<string, AoeFactor> = { ...state.aoeFactors }
  for (const id of state.checked) {
    if (next[id] === undefined) next[id] = state.aoeResults[id]?.verdict === 'saved' ? 0.5 : 1
  }
  return next
}

export type TrackerUiAction =
  | { type: 'select'; id: string }
  | { type: 'togglePin'; id: string }
  | { type: 'armAoe' }
  /** Leaving the AoE bar resets it completely — see the reducer. */
  | { type: 'exitAoe' }
  | { type: 'setChecked'; checked: ReadonlySet<string> }
  | { type: 'setAoeAmount'; amount: string }
  /** A rolled total lands in the AoE bar and arms it, in one step. */
  | { type: 'sendRollToAoe'; amount: number }
  /** Move the bar to a step. Reaching `apply` seeds the factors. */
  | { type: 'setAoeStep'; step: AoeStep }
  | { type: 'setAoeSave'; ability?: Ability | null; dc?: string }
  /** A fresh roll of the table's saves. */
  | { type: 'setAoeResults'; results: Readonly<Record<string, AoeResult>> }
  /** One target rolled at the table, or the DM read it differently. */
  | { type: 'flipAoeResult'; id: string }
  | { type: 'setAoeFactor'; id: string; factor: AoeFactor }
  /** The active turn changed: an unpinned panel follows it again. */
  | { type: 'turnChanged' }

export function trackerUiReducer(state: TrackerUiState, action: TrackerUiAction): TrackerUiState {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id }

    case 'togglePin':
      return { ...state, pinnedId: state.pinnedId === action.id ? null : action.id }

    case 'armAoe':
      // Arming starts at step 1 with nothing carried over, even if the bar was
      // somehow left armed: an AoE is one spell, and the previous one's targets,
      // rolls and factors belong to it.
      return state.multiSelect ? state : { ...state, ...CLEARED_AOE, multiSelect: true }

    case 'exitAoe':
      // Leaving resets the bar entirely — targets, amount, rolls and factors.
      // Coming back to a set of checkboxes and a damage number chosen for a
      // spell three turns ago is never what was meant, and applying is the
      // ordinary way out, so a factor that survived would silently halve the
      // next fireball.
      return { ...state, ...CLEARED_AOE, multiSelect: false }

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

    case 'setAoeStep':
      return action.step === 'apply'
        ? { ...state, aoeStep: action.step, aoeFactors: seedFactors(state) }
        : { ...state, aoeStep: action.step }

    case 'setAoeSave':
      return {
        ...state,
        ...(action.ability !== undefined && { aoeSaveAbility: action.ability }),
        ...(action.dc !== undefined && { aoeSaveDc: action.dc }),
        // Changing the ability or the DC makes every roll read against them
        // stale, and a factor seeded from a stale verdict is a wrong number
        // wearing the DM's own handwriting.
        aoeResults: {},
        aoeFactors: {},
      }

    case 'setAoeResults':
      // A fresh roll clears the factors so step 3 seeds from what was just
      // rolled. That does discard a factor set by hand, which is the right
      // trade: the hand-set factor was an answer about a verdict that no longer
      // exists, and keeping it would leave the row disagreeing with its own
      // result chip.
      return { ...state, aoeResults: action.results, aoeFactors: {} }

    case 'flipAoeResult': {
      const current = state.aoeResults[action.id]
      if (!current) return state
      const verdict = current.verdict === 'saved' ? 'failed' : 'saved'
      // The factor seeded from the old verdict goes with it; the new one is
      // seeded on the way into step 3.
      const { [action.id]: _dropped, ...factors } = state.aoeFactors
      return {
        ...state,
        aoeResults: { ...state.aoeResults, [action.id]: { ...current, verdict } },
        aoeFactors: factors,
      }
    }

    case 'setAoeFactor':
      return { ...state, aoeFactors: { ...state.aoeFactors, [action.id]: action.factor } }

    case 'turnChanged':
      return state.selectedId === null ? state : { ...state, selectedId: null }
  }
}

export function useTrackerUi(): [TrackerUiState, Dispatch<TrackerUiAction>] {
  return useReducer(trackerUiReducer, initialTrackerUi)
}
