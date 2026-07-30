import { mdiDiceMultiple } from '@mdi/js'
import { useCallback, useEffect, useState } from 'react'
import './viewer.css'
import { DiceRoller } from '../../components/DiceRoller'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { describeCondition } from '../../data/conditionInfo'
import type { PlayerParticipant, PlayerSnapshot } from './projection'
import { connectBroadcastViewer, connectPeerViewer, LOCAL_CODE, type ViewerStatus } from './transport'

/** Monster HP stays a status word; only PCs show numbers. */
function Health({ participant }: { participant: PlayerParticipant }) {
  const h = participant.health
  if (h.kind === 'pc') {
    return (
      <span className="pv-health pc num">
        {h.hp}/{h.maxHp}
        {h.tempHp > 0 && <span className="pv-temp"> +{h.tempHp}</span>}
      </span>
    )
  }
  return <span className={`pv-health status-${h.status.toLowerCase()}`}>{h.status}</span>
}

function Conditions({
  participant,
  onOpen,
}: {
  participant: PlayerParticipant
  onOpen: (condition: string) => void
}) {
  if (participant.conditions.length === 0) return null
  return (
    <span className="pv-conditions">
      {participant.conditions.map((c) => (
        <button
          key={c.condition}
          type="button"
          className="pv-chip"
          title={`What does ${c.condition} do?`}
          onClick={() => onOpen(c.condition)}
        >
          {c.condition === 'Exhaustion' ? `Exhaustion ${c.level ?? 1}` : c.condition}
          {c.remainingRounds != null && ` (${c.remainingRounds})`}
        </button>
      ))}
    </span>
  )
}

/** The creature acting right now, given the whole width it deserves. */
function Spotlight({
  participant,
  onCondition,
}: {
  participant: PlayerParticipant
  onCondition: (condition: string) => void
}) {
  return (
    <section className="pv-spotlight">
      <p className="pv-spotlight-label">Acting now</p>
      <div className="pv-spotlight-head">
        <h2 className="pv-spotlight-name">{participant.name}</h2>
        <span className={`badge ${participant.isPC ? 'pc' : 'group'}`}>{participant.isPC ? 'PC' : 'Monster'}</span>
      </div>
      <div className="pv-spotlight-stats">
        <Health participant={participant} />
      </div>
      {participant.health.kind === 'pc' && (
        <span className="hp-meter pv-spotlight-meter">
          <span
            className="hp-meter-fill"
            style={{
              width: `${Math.max(0, Math.min(100, (participant.health.hp / Math.max(1, participant.health.maxHp)) * 100))}%`,
            }}
          />
        </span>
      )}
      <Conditions participant={participant} onOpen={onCondition} />
    </section>
  )
}

export function ViewerApp({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null)
  const [status, setStatus] = useState<ViewerStatus>('connecting')
  const [showDice, setShowDice] = useState(false)
  const [conditionInfo, setConditionInfo] = useState<string | null>(null)
  // stable identity: an arriving snapshot must not re-render the open roller
  // and clobber the expression the player is halfway through typing
  const closeDice = useCallback(() => setShowDice(false), [])

  useEffect(() => {
    const handlers = { onSnapshot: setSnapshot, onStatus: setStatus }
    const transport =
      code.toLowerCase() === LOCAL_CODE ? connectBroadcastViewer(handlers) : connectPeerViewer(code, handlers)
    return () => transport.close()
  }, [code])

  const active = snapshot?.participants.find((p) => p.id === snapshot.activeId) ?? null
  // The spotlight already carries whoever is acting, so the order list below
  // shows everyone else — repeating the active row would just waste a phone's
  // very limited height.
  const others = snapshot?.participants.filter((p) => p.id !== snapshot.activeId) ?? []

  return (
    <div className="pv-app">
      <header className="pv-header">
        <span className="pv-round">
          {snapshot?.isRunning ? `Round ${snapshot.round}` : snapshot ? 'Forming up…' : '—'}
        </span>
        <h1>Battle</h1>
        <button type="button" className="pv-dice-btn" aria-label="Dice Roller" onClick={() => setShowDice(true)}>
          <Icon path={mdiDiceMultiple} />
        </button>
      </header>

      {showDice && <DiceRoller onClose={closeDice} />}
      {conditionInfo && (
        <Modal title={conditionInfo} onClose={() => setConditionInfo(null)}>
          <p>{describeCondition(conditionInfo) ?? 'A custom effect — ask your DM what it does.'}</p>
        </Modal>
      )}

      {status !== 'connected' && (
        <div className="pv-status" role="status">
          {status === 'ended' ? 'Session ended.' : `${status === 'connecting' ? 'Connecting' : 'Reconnecting'}…`}
        </div>
      )}

      <div className="pv-body">
        <div className="pv-primary">
          {/* Turn rail: circular initiative tokens, the active one enlarged. */}
          {snapshot && snapshot.participants.length > 0 && (
            <ol className="pv-rail">
              {snapshot.participants.map((p) => (
                <li key={p.id} className={p.id === snapshot.activeId ? 'active' : ''}>
                  <span className="pv-token" title={p.name}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {active && <Spotlight participant={active} onCondition={setConditionInfo} />}
          <button type="button" className="pv-roll-wide" onClick={() => setShowDice(true)}>
            <Icon path={mdiDiceMultiple} /> Roll dice
          </button>
        </div>

        <ol className="pv-list">
          {others.map((p) => (
            <li key={p.id}>
              <span className="pv-name">
                <span className="pv-name-row">
                  <span className="pv-name-text">{p.name}</span>
                  {p.isPC && <span className="badge pc">PC</span>}
                </span>
                <Conditions participant={p} onOpen={setConditionInfo} />
              </span>
              <Health participant={p} />
            </li>
          ))}
          {snapshot && snapshot.participants.length === 0 && <li className="pv-empty">Waiting for combatants…</li>}
        </ol>
      </div>
    </div>
  )
}
