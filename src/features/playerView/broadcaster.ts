// Subscribes to the battle store (the single state-update path) and pushes
// throttled snapshots to all active transports.

import { battleStore } from '../../store/battleStore'
import { projectSnapshot } from './projection'
import {
  generateJoinCode,
  startBroadcastHost,
  startPeerHost,
  type HostTransport,
  type PeerHostSession,
} from './transport'

const THROTTLE_MS = 250 // ~4 snapshots/s max

class PlayerViewHost {
  private broadcast: HostTransport | null = null
  private peer: PeerHostSession | null = null
  private unsubscribe: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending = false
  private listeners = new Set<() => void>()
  viewerCount = 0

  get isRunning(): boolean {
    return this.peer !== null
  }

  get code(): string | null {
    return this.peer?.code ?? null
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  /** Same-device BroadcastChannel host; cheap, runs whenever the DM app is open. */
  ensureLocalHost(): void {
    if (this.broadcast) return
    this.broadcast = startBroadcastHost()
    this.subscribe()
    this.push()
  }

  /** Starts the remote (PeerJS) session and returns the join code. */
  async startRemote(): Promise<string> {
    if (this.peer) return this.peer.code
    const session = await startPeerHost(generateJoinCode())
    session.onViewerCount((count) => {
      this.viewerCount = count
      this.emit()
    })
    this.peer = session
    this.subscribe()
    this.push()
    this.emit()
    return session.code
  }

  /** Ends the remote session, disconnecting all viewers. */
  stopRemote(): void {
    this.peer?.stop()
    this.peer = null
    this.viewerCount = 0
    this.emit()
  }

  private subscribe(): void {
    this.unsubscribe ??= battleStore.subscribe(() => this.schedule())
  }

  private schedule(): void {
    if (this.timer) {
      this.pending = true
      return
    }
    this.push()
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (this.pending) {
        this.pending = false
        this.schedule()
      }
    }, THROTTLE_MS)
  }

  private push(): void {
    const snapshot = projectSnapshot(battleStore.getState())
    this.broadcast?.send(snapshot)
    this.peer?.send(snapshot)
  }
}

export const playerViewHost = new PlayerViewHost()
