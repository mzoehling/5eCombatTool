import { mdiPlay } from '@mdi/js'
import { useEffect, useState } from 'react'
import './viewer.css'
import { Icon } from '../../components/Icon'
import type { PlayerParticipant, PlayerSnapshot } from './projection'
import { connectBroadcastViewer, connectPeerViewer, LOCAL_CODE, type ViewerStatus } from './transport'

function Health({ participant }: { participant: PlayerParticipant }) {
  const h = participant.health
  if (h.kind === 'pc') {
    return (
      <span className="pv-health pc">
        {h.hp}/{h.maxHp}
        {h.tempHp > 0 && <span className="pv-temp"> +{h.tempHp}</span>}
      </span>
    )
  }
  return <span className={`pv-health status-${h.status.toLowerCase()}`}>{h.status}</span>
}

export function ViewerApp({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null)
  const [status, setStatus] = useState<ViewerStatus>('connecting')

  useEffect(() => {
    const handlers = { onSnapshot: setSnapshot, onStatus: setStatus }
    const transport =
      code.toLowerCase() === LOCAL_CODE ? connectBroadcastViewer(handlers) : connectPeerViewer(code, handlers)
    return () => transport.close()
  }, [code])

  return (
    <div className="pv-app">
      <header className="pv-header">
        <h1>Battle</h1>
        {snapshot?.isRunning && <span className="pv-round">Round {snapshot.round}</span>}
        {snapshot && !snapshot.isRunning && <span className="pv-round dim">forming up…</span>}
      </header>

      {status !== 'connected' && (
        <div className="pv-status" role="status">
          {status === 'ended' ? 'Session ended.' : `${status === 'connecting' ? 'Connecting' : 'Reconnecting'}…`}
        </div>
      )}

      <ol className="pv-list">
        {snapshot?.participants.map((p) => (
          <li key={p.id} className={p.id === snapshot.activeId ? 'active' : ''}>
            <span className="pv-marker">{p.id === snapshot.activeId && <Icon path={mdiPlay} size={16} />}</span>
            <span className="pv-name">
              {p.name}
              {p.conditions.length > 0 && (
                <span className="pv-conditions">
                  {p.conditions.map((c) => (
                    <span key={c.condition} className="pv-chip">
                      {c.condition === 'Exhaustion' ? `Exhaustion ${c.level ?? 1}` : c.condition}
                      {c.remainingRounds != null && ` (${c.remainingRounds})`}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <Health participant={p} />
          </li>
        ))}
        {snapshot && snapshot.participants.length === 0 && <li className="pv-empty">Waiting for combatants…</li>}
      </ol>
    </div>
  )
}
