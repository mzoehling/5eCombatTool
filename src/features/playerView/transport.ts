// Transport abstraction for the Player View broadcast. The snapshot
// projection and viewer UI are transport-agnostic; only the wire differs:
// - PeerTransport: WebRTC DataChannels brokered via the public PeerJS cloud
// - BroadcastTransport: same-origin BroadcastChannel (second window on the
//   same device, e.g. an AirPlay/USB-C external display) — no network at all

import { parseSnapshotMessage, wrapSnapshot, type PlayerSnapshot } from './projection'

/** Join codes: unambiguous alphabet (no 0/O/1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LOCAL_CODE = 'local'

export function generateJoinCode(length = 6): string {
  const values = crypto.getRandomValues(new Uint32Array(length))
  return [...values].map((v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join('')
}

/** Namespaced PeerJS id for a session code. */
export function peerIdForCode(code: string): string {
  return `5eBattleTracker-${code.toUpperCase()}`
}

const BROADCAST_CHANNEL = '5eCombatTool-player-view'

export interface HostTransport {
  /** Send a snapshot to all connected viewers. */
  send(snapshot: PlayerSnapshot): void
  stop(): void
}

export type ViewerStatus = 'connecting' | 'connected' | 'reconnecting' | 'ended'

export interface ViewerHandlers {
  onSnapshot(snapshot: PlayerSnapshot): void
  onStatus(status: ViewerStatus): void
}

export interface ViewerTransport {
  close(): void
}

// ---------- BroadcastChannel (same device) ----------

export function startBroadcastHost(): HostTransport {
  const channel = new BroadcastChannel(BROADCAST_CHANNEL)
  let last: PlayerSnapshot | null = null
  // late-joining viewers ask for the current state
  channel.onmessage = (event) => {
    if (event.data === 'hello' && last) channel.postMessage(wrapSnapshot(last))
  }
  return {
    send(snapshot) {
      last = snapshot
      channel.postMessage(wrapSnapshot(snapshot))
    },
    stop() {
      channel.close()
    },
  }
}

export function connectBroadcastViewer(handlers: ViewerHandlers): ViewerTransport {
  const channel = new BroadcastChannel(BROADCAST_CHANNEL)
  handlers.onStatus('connecting')
  channel.onmessage = (event) => {
    const snapshot = parseSnapshotMessage(event.data)
    if (snapshot) {
      handlers.onStatus('connected')
      handlers.onSnapshot(snapshot)
    }
  }
  channel.postMessage('hello')
  return {
    close() {
      channel.close()
    },
  }
}

// ---------- PeerJS (remote viewers) ----------

interface PeerConnection {
  open: boolean
  send(data: unknown): void
  close(): void
  on(event: 'open' | 'close' | 'error', cb: (arg?: unknown) => void): void
}

export interface PeerHostSession extends HostTransport {
  readonly code: string
  onViewerCount(cb: (count: number) => void): void
}

/** Hosts a PeerJS session; resolves once the broker registers the id. */
export async function startPeerHost(code: string): Promise<PeerHostSession> {
  const { default: Peer } = await import('peerjs')
  const peer = new Peer(peerIdForCode(code))
  const connections = new Set<PeerConnection>()
  let last: PlayerSnapshot | null = null
  let notifyCount: (count: number) => void = () => {}

  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve())
    peer.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))))
  })

  peer.on('connection', (conn) => {
    const c = conn as unknown as PeerConnection
    c.on('open', () => {
      connections.add(c)
      notifyCount(connections.size)
      // a (re)connecting viewer is current after one message
      if (last) c.send(wrapSnapshot(last))
    })
    const drop = () => {
      connections.delete(c)
      notifyCount(connections.size)
    }
    c.on('close', drop)
    c.on('error', drop)
  })

  return {
    code,
    send(snapshot) {
      last = snapshot
      const message = wrapSnapshot(snapshot)
      for (const c of connections) if (c.open) c.send(message)
    },
    onViewerCount(cb) {
      notifyCount = cb
      cb(connections.size)
    },
    stop() {
      for (const c of connections) c.close()
      connections.clear()
      peer.destroy()
    },
  }
}

/** Connects a viewer to a host code; retries with backoff until closed. */
export function connectPeerViewer(code: string, handlers: ViewerHandlers): ViewerTransport {
  let closed = false
  let attempt = 0
  let peer: { destroy(): void } | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const connect = async () => {
    if (closed) return
    handlers.onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
    const { default: Peer } = await import('peerjs')
    if (closed) return
    const p = new Peer()
    peer = p

    const retry = () => {
      p.destroy()
      if (closed) return
      attempt += 1
      handlers.onStatus('reconnecting')
      retryTimer = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)))
    }

    p.on('open', () => {
      const conn = p.connect(peerIdForCode(code), { reliable: true })
      conn.on('data', (data: unknown) => {
        const snapshot = parseSnapshotMessage(data)
        if (snapshot) {
          attempt = 0
          handlers.onStatus('connected')
          handlers.onSnapshot(snapshot)
        }
      })
      conn.on('close', retry)
      conn.on('error', retry)
    })
    p.on('error', retry)
    p.on('disconnected', retry)
  }

  void connect()

  return {
    close() {
      closed = true
      clearTimeout(retryTimer)
      peer?.destroy()
      handlers.onStatus('ended')
    },
  }
}
