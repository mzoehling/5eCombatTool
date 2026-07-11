import { battleStore, useBattleState } from '../store/battleStore'

export function BattleControls() {
  const { dispatch } = battleStore
  const { battle, combatants } = useBattleState()

  if (!battle.isRunning) {
    return (
      <div className="battle-controls">
        <button
          type="button"
          className="primary"
          disabled={combatants.length === 0}
          onClick={() => dispatch({ type: 'startBattle' })}
        >
          ▶ Start battle
        </button>
      </div>
    )
  }

  return (
    <div className="battle-controls">
      <button type="button" onClick={() => dispatch({ type: 'prevTurn' })} aria-label="Previous turn">
        ◀ Back
      </button>
      <span className="round-counter">Round {battle.round}</span>
      <button type="button" className="primary next-btn" onClick={() => dispatch({ type: 'nextTurn' })} aria-label="Next turn">
        Next ▶
      </button>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'endBattle' })}>
        End
      </button>
    </div>
  )
}
