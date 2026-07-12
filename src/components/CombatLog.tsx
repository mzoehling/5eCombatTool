import { useCombatLog } from '../store/battleStore'
import { Modal } from './Modal'

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Chronological record of battle events (latest first). */
export function CombatLog({ onClose }: { onClose: () => void }) {
  const log = useCombatLog()

  return (
    <Modal title="Combat Log" onClose={onClose}>
      {log.length === 0 ? (
        <p className="dim">Nothing logged yet — actions appear here as the battle runs.</p>
      ) : (
        <ul className="combat-log">
          {[...log].reverse().map((entry, i) => (
            <li key={log.length - i}>
              <span className="log-time dim">{formatTime(entry.at)}</span>
              <span className="log-round dim">R{entry.round}</span>
              <span className="log-message">{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
