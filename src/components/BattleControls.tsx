import { mdiChevronLeft, mdiChevronRight, mdiPlay } from '@mdi/js'
import { battleStore, useBattleState } from '../store/battleStore'
import { Icon } from './Icon'

export function BattleControls() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()

  if (!battle.isRunning) {
    return (
      <div className="battle-controls">
        <button
          type="button"
          className="primary icon-label"
          disabled={combatants.length === 0}
          onClick={() => dispatch({ type: 'startBattle' })}
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
        onClick={() => dispatch({ type: 'nextTurn' })}
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
