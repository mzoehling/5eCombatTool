import { mdiChevronLeft, mdiChevronRight, mdiHistory, mdiPlay } from '@mdi/js'
import { useState } from 'react'
import { rollDie } from '../lib/dice'
import { battleStore, useBattleState } from '../store/battleStore'
import { History } from './History'
import { Icon } from './Icon'

/** Pre-rolled d6 pool for the reducer's recharge checks (it stays pure). */
const rechargeDice = () => Array.from({ length: 8 }, () => rollDie(6))

/**
 * Undo and the combat log, as one button.
 *
 * They were two icons for one idea — what happened, and taking the last of it
 * back. The popover carries both, so the top bar carries one button.
 */
export function HistoryButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ghost icon-only"
        aria-label="History"
        title="History — recent actions and undo"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon path={mdiHistory} />
      </button>
      {open && <History onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Turn control, in the middle of the top bar.
 *
 * It used to sit in the dock below the list so it could not scroll out of
 * reach — the top bar cannot scroll either, and putting the round where the eye
 * already goes for state leaves the dock to the tools. `Next turn` is the app's
 * one accent element.
 *
 * Before the fight the same slot holds `Start battle` at the same size, so
 * starting a battle does not move anything.
 */
export function TurnControls() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()

  if (!battle.isRunning) {
    return (
      <div className="turn-controls">
        <button
          type="button"
          className="primary icon-label next-btn"
          disabled={combatants.length === 0}
          onClick={() => dispatch({ type: 'startBattle', dice: rechargeDice() })}
        >
          <Icon path={mdiPlay} /> Start battle
        </button>
      </div>
    )
  }

  return (
    <div className="turn-controls">
      <button
        type="button"
        className="ghost icon-only turn-step"
        onClick={() => dispatch({ type: 'prevTurn' })}
        aria-label="Previous turn"
        title="Previous turn"
      >
        <Icon path={mdiChevronLeft} />
      </button>
      <span className="round-counter">Round {battle.round}</span>
      <button
        type="button"
        className="primary icon-only turn-step next-btn"
        onClick={() => dispatch({ type: 'nextTurn', dice: rechargeDice() })}
        aria-label="Next turn"
        title="Next turn (Space)"
      >
        <Icon path={mdiChevronRight} />
      </button>
    </div>
  )
}
