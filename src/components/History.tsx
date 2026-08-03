import { mdiUndoVariant } from '@mdi/js'
import { Fragment, useEffect, useRef, useState } from 'react'
import { historySteps } from '../lib/history'
import { battleStore, useCombatLog, useReloadBoundary, useUndoableStep } from '../store/battleStore'
import { CombatLog } from './CombatLog'
import { Icon } from './Icon'

/** How many steps the popover shows before pointing at the full log. */
const POPOVER_STEPS = 12

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * "What just happened, and take it back" in one popover.
 *
 * Only the newest step carries the undo icon, and that is a property of the
 * store rather than a simplification: undo is a stack of whole state snapshots,
 * so there is no way to reverse one line from the middle. Being honest about it
 * is better than an icon on every row that only works on one of them.
 */
export function History({ onClose }: { onClose: () => void }) {
  const log = useCombatLog()
  const undoableStep = useUndoableStep()
  const preReloadStep = useReloadBoundary()
  const [showFullLog, setShowFullLog] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // A popover closes when the DM taps anywhere else — it is a glance, not a
  // dialog, so it must not need dismissing before the next action.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      // The button that opened it toggles; letting the outside handler close it
      // too would make the second tap reopen it.
      if ((e.target as HTMLElement).closest('[aria-expanded]')) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (showFullLog) return <CombatLog onClose={() => setShowFullLog(false)} />

  const steps = historySteps(log, { undoableStep, preReloadStep }).slice(0, POPOVER_STEPS)

  return (
    <div className="history-popover" ref={ref} role="dialog" aria-label="History">
      {steps.length === 0 ? (
        <p className="dim">Nothing yet — actions appear here as the battle runs.</p>
      ) : (
        <ul className="history-list">
          {steps.map((step) => (
            <Fragment key={step.step}>
              {step.firstBeforeReload && (
                <li className="history-boundary">
                  {/* The log is persisted, the undo stack is not. Without saying
                      so, a list with no undo icon anywhere reads as broken. */}
                  before reloading — no longer undoable
                </li>
              )}
              <li className={step.reverted ? 'reverted' : undefined}>
                <span className="history-time">{formatTime(step.at)}</span>
                <span className="history-round">R{step.round}</span>
                <span className="history-messages">
                  {step.entries.map((entry, i) => (
                    <span key={i}>{entry.message}</span>
                  ))}
                </span>
                {step.undoable && (
                  <button
                    type="button"
                    className="ghost icon-only history-undo"
                    aria-label="Undo this"
                    title="Undo this (Ctrl+Z)"
                    onClick={battleStore.undo}
                  >
                    <Icon path={mdiUndoVariant} />
                  </button>
                )}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
      <footer className="history-footer">
        <button type="button" className="ghost" onClick={() => setShowFullLog(true)}>
          Full combat log
        </button>
      </footer>
    </div>
  )
}
