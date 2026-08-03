import { Fragment } from 'react'
import { useCombatLog } from '../store/battleStore'
import { Modal } from './Modal'

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Which kind of event a log line describes, read off the strings `logMessages`
 * actually produces. Only used to colour the dot in front of the line, so an
 * unrecognised message simply falls through to the neutral 'turn'.
 */
function eventKind(message: string): 'damage' | 'healing' | 'condition' | 'turn' {
  if (/\bdamage\b/.test(message)) return 'damage'
  if (/\bhealing\b/.test(message)) return 'healing'
  if (/expired on |: [A-Z][a-z]+ removed$|Concentration/.test(message)) return 'condition'
  return 'turn'
}

/** Chronological record of battle events (latest first). */
export function CombatLog({ onClose }: { onClose: () => void }) {
  const log = useCombatLog()
  const newestFirst = [...log].reverse()

  return (
    <Modal title="Combat Log" onClose={onClose}>
      {log.length === 0 ? (
        <p className="dim">Nothing logged yet — actions appear here as the battle runs.</p>
      ) : (
        <ul className="combat-log">
          {newestFirst.map((entry, i) => {
            // Newest first, so a round divider belongs above the first line of
            // each round as the eye travels down into the older entries.
            const startsRound = i === 0 || newestFirst[i - 1].round !== entry.round
            return (
              <Fragment key={log.length - i}>
                {startsRound && <li className="log-round-divider">Round {entry.round}</li>}
                {/* Undone lines stay as a record of what the DM did, struck
                    through rather than deleted. */}
                <li className={entry.reverted ? 'reverted' : undefined}>
                  <span className={`log-dot ${eventKind(entry.message)}`} aria-hidden="true" />
                  <span className="log-time">{formatTime(entry.at)}</span>
                  <span className="log-round">R{entry.round}</span>
                  <span className="log-message">{entry.message}</span>
                </li>
              </Fragment>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
