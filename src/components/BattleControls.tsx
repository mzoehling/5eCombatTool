import { mdiChevronLeft, mdiChevronRight, mdiHistory, mdiPlay, mdiUndo } from '@mdi/js'
import { useState } from 'react'
import { rollDie } from '../lib/dice'
import { battleStore, useBattleState, useUndoDepth } from '../store/battleStore'
import { CombatLog } from './CombatLog'
import { Icon } from './Icon'

/** Pre-rolled d6 pool for the reducer's recharge checks (it stays pure). */
const rechargeDice = () => Array.from({ length: 8 }, () => rollDie(6))

/** Undo and the combat log. These live in the top bar, away from turn control. */
export function HistoryButtons() {
  const undoDepth = useUndoDepth()
  const [showLog, setShowLog] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ghost icon-only"
        disabled={undoDepth === 0}
        aria-label="Undo"
        title="Undo the last change (Ctrl+Z)"
        onClick={battleStore.undo}
      >
        <Icon path={mdiUndo} />
      </button>
      <button
        type="button"
        className="ghost icon-only"
        aria-label="Combat log"
        title="Combat log"
        onClick={() => setShowLog(true)}
      >
        <Icon path={mdiHistory} />
      </button>
      {showLog && <CombatLog onClose={() => setShowLog(false)} />}
    </>
  )
}

/** Turn control. It lives in the dock pinned below the tracker list, so it
 *  never moves as the list scrolls — that is the whole point of the dock. */
export function BattleControls() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()

  if (!battle.isRunning) {
    return (
      <div className="battle-controls">
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
    <div className="battle-controls">
      <button type="button" className="icon-label" onClick={() => dispatch({ type: 'prevTurn' })} aria-label="Previous turn">
        <Icon path={mdiChevronLeft} /> Back
      </button>
      <span className="round-counter">Round {battle.round}</span>
      <button
        type="button"
        className="primary next-btn icon-label"
        onClick={() => dispatch({ type: 'nextTurn', dice: rechargeDice() })}
        aria-label="Next turn"
      >
        Next turn <Icon path={mdiChevronRight} />
      </button>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'endBattle' })}>
        End
      </button>
    </div>
  )
}
