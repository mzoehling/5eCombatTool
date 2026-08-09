import { mdiPlay } from '@mdi/js'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { renderSVG } from 'uqr'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { playerViewHost } from './broadcaster'
import { LOCAL_CODE, type HostDiagnostics, type HostStatus } from './transport'

function viewerUrl(code: string): string {
  return `${location.origin}${location.pathname}#/play/${code}`
}

function useHostState() {
  return useSyncExternalStore(
    (cb) => playerViewHost.onChange(cb),
    () => `${playerViewHost.code ?? ''}:${playerViewHost.viewerCount}:${playerViewHost.hostStatus}`,
  )
}

const JOIN_SERVER_TEXT: Record<HostStatus, string> = {
  live: 'connected',
  reconnecting: 'reconnecting',
  offline: 'not connected',
}

/**
 * The state that used to be invisible.
 *
 * A host whose broker connection has dropped keeps serving everyone already
 * watching, so the dialog looked perfectly healthy while no new player could join
 * — the DM had nothing to go on. This says which of the two is true.
 */
function JoinServerNotice({ status }: { status: HostStatus }) {
  if (status === 'live') return null
  return (
    <p className="pv-host-warn" role="status">
      {status === 'reconnecting'
        ? 'Reconnecting to the join server. Players already watching are unaffected, but a new player cannot join until this clears.'
        : 'Not connected to the join server. Players already watching are unaffected; end the session and start it again to let new players in.'}
    </p>
  )
}

/**
 * What the connection is actually doing, for a DM who has to fix it at a table.
 *
 * The candidate path is the line worth having: `relayed` says the relay is
 * carrying the table because the network forbids anything direct, and a path
 * stuck on `negotiating` says the network dropped every candidate there was —
 * two problems that look identical from the outside and have different answers.
 */
function ConnectionDetails() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<HostDiagnostics | null>(null)

  useEffect(() => {
    // Polled rather than pushed: candidate-pair statistics live on the
    // RTCPeerConnection and change with no event to hang a subscription on. Only
    // while the disclosure is open, though — `getStats()` per viewer every couple
    // of seconds is not something to run behind a summary nobody has opened.
    if (!open) return
    const read = () => {
      void playerViewHost.diagnostics()?.then(setInfo)
    }
    read()
    const timer = setInterval(read, 2000)
    return () => clearInterval(timer)
  }, [open])

  const sentAgo = info?.lastSentAt == null ? null : Math.round((Date.now() - info.lastSentAt) / 1000)

  return (
    <details className="pv-diagnostics" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Connection details</summary>
      {info && (
        <dl>
          <dt>Join server</dt>
          <dd>
            {JOIN_SERVER_TEXT[info.status]}
            {info.detail && ` — ${info.detail}`}
          </dd>
          <dt>Last update sent</dt>
          <dd>{sentAgo === null ? 'nothing sent yet' : `${sentAgo}s ago`}</dd>
          <dt>{info.viewers.length === 1 ? 'Viewer' : 'Viewers'}</dt>
          <dd>
            {info.viewers.length === 0 ? 'none connected' : info.viewers.map((path, i) => <span key={i}>{path}</span>)}
          </dd>
        </dl>
      )}
    </details>
  )
}

export function HostControls({ onClose }: { onClose: () => void }) {
  useHostState()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const code = playerViewHost.code

  const start = async () => {
    setStarting(true)
    setError('')
    try {
      await playerViewHost.startRemote()
    } catch (err) {
      setError(
        `Could not reach the join server (${err instanceof Error ? err.message : String(err)}). ` +
          'Remote viewers need internet; the same-device viewer below works regardless.',
      )
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal title="Player View" onClose={onClose}>
      {code ? (
        <div className="pv-host">
          {/* The code gets read aloud across a table, so it leads the dialog. */}
          <p className="dim">Players open the app and enter this code — or scan the QR.</p>
          <div className="pv-code">{code}</div>
          <div
            className="pv-qr"
            aria-label={`QR code for ${viewerUrl(code)}`}
            dangerouslySetInnerHTML={{ __html: renderSVG(viewerUrl(code)) }}
          />
          <p className="pv-link">{viewerUrl(code)}</p>
          <p className="pv-viewers">
            {playerViewHost.viewerCount} {playerViewHost.viewerCount === 1 ? 'viewer' : 'viewers'} connected
          </p>
          <JoinServerNotice status={playerViewHost.hostStatus} />
          <ConnectionDetails />
        </div>
      ) : (
        <div className="pv-host">
          <p>
            Start a session to let players watch the battle on their own devices — read-only, with monster HP shown
            only as a rough status.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="primary icon-label" disabled={starting} onClick={start}>
              {starting ? 'Starting…' : (
                <>
                  <Icon path={mdiPlay} /> Start Player View
                </>
              )}
            </button>
          </div>
        </div>
      )}
      <hr className="pv-divider" />
      <p className="dim">
        Shared screen on this device (AirPlay / external display): open the viewer in a second window — no network or
        code needed.
      </p>
      {/* Both session-level actions sit together in one right-aligned row. */}
      <div className="modal-footer">
        <span className="spacer" />
        <button type="button" onClick={() => window.open(viewerUrl(LOCAL_CODE), '_blank')}>
          Same-device viewer
        </button>
        {code && (
          <button type="button" className="danger" onClick={() => playerViewHost.stopRemote()}>
            End session
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Keeps the same-device BroadcastChannel host alive while the DM app runs. */
export function useLocalPlayerViewHost(): void {
  useEffect(() => playerViewHost.ensureLocalHost(), [])
}
