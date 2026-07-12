import { mdiChevronLeft, mdiChevronRight, mdiHistory, mdiPlay, mdiUndo } from '@mdi/js'
import { useState } from 'react'
import { rollDie } from '../lib/dice'
import { battleStore, useBattleState, useUndoDepth } from '../store/battleStore'
import { CombatLog } from './CombatLog'
import { Icon } from './Icon'

/** Pre-rolled d6 pool for the reducer's recharge checks (it stays pure). */
const rechargeDice = () => Array.from({ length: 8 }, () => rollDie(6))

function HistoryButtons() {
  const undoDepth = useUndoDepth()
  const [showLog, setShowLog] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ghost"
        disabled={undoDepth === 0}
        aria-label="Undo"
        title="Undo the last change (Ctrl+Z)"
        onClick={battleStore.undo}
      >
        <Icon path={mdiUndo} />
      </button>
      <button type="button" className="ghost" aria-label="Combat log" title="Combat log" onClick={() => setShowLog(true)}>
        <Icon path={mdiHistory} />
      </button>
      {showLog && <CombatLog onClose={() => setShowLog(false)} />}
    </>
  )
}

export function BattleControls() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()

  if (!battle.isRunning) {
    return (
      <div className="battle-controls">
        <HistoryButtons />
        <button
          type="button"
          className="primary icon-label"
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
      <HistoryButtons />
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
        Next <Icon path={mdiChevronRight} />
      </button>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'endBattle' })}>
        End
      </button>
    </div>
  )
}
