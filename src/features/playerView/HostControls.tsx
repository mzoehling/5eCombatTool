import { useEffect, useState, useSyncExternalStore } from 'react'
import { renderSVG } from 'uqr'
import { Modal } from '../../components/Modal'
import { playerViewHost } from './broadcaster'
import { LOCAL_CODE } from './transport'

function viewerUrl(code: string): string {
  return `${location.origin}${location.pathname}#/play/${code}`
}

function useHostState() {
  return useSyncExternalStore(
    (cb) => playerViewHost.onChange(cb),
    () => `${playerViewHost.code ?? ''}:${playerViewHost.viewerCount}`,
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
        `Could not reach the signaling server (${err instanceof Error ? err.message : String(err)}). ` +
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
          <p>
            Players open the app and enter this code — or scan the QR. Connected viewers:{' '}
            <b>{playerViewHost.viewerCount}</b>
          </p>
          <div className="pv-code">{code}</div>
          <div
            className="pv-qr"
            aria-label={`QR code for ${viewerUrl(code)}`}
            dangerouslySetInnerHTML={{ __html: renderSVG(viewerUrl(code)) }}
          />
          <p className="dim pv-link">{viewerUrl(code)}</p>
          <div className="modal-actions">
            <button type="button" className="danger" onClick={() => playerViewHost.stopRemote()}>
              End session
            </button>
          </div>
        </div>
      ) : (
        <div className="pv-host">
          <p>
            Start a session to let players watch the battle on their own devices — read-only, with monster HP shown
            only as a rough status.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="primary" disabled={starting} onClick={start}>
              {starting ? 'Starting…' : '▶ Start Player View'}
            </button>
          </div>
        </div>
      )}
      <hr className="pv-divider" />
      <p className="dim">
        Shared screen on this device (AirPlay / external display): open the viewer in a second window — no network or
        code needed.
      </p>
      <div className="modal-actions">
        <button type="button" onClick={() => window.open(viewerUrl(LOCAL_CODE), '_blank')}>
          Open same-device viewer
        </button>
      </div>
    </Modal>
  )
}

/** Keeps the same-device BroadcastChannel host alive while the DM app runs. */
export function useLocalPlayerViewHost(): void {
  useEffect(() => playerViewHost.ensureLocalHost(), [])
}
