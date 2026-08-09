// Transport abstraction for the Player View broadcast. The snapshot
// projection and viewer UI are transport-agnostic; only the wire differs:
// - PeerTransport: WebRTC DataChannels brokered via the public PeerJS cloud
// - BroadcastTransport: same-origin BroadcastChannel (second window on the
//   same device, e.g. an AirPlay/USB-C external display) — no network at all
//
// Both peer transports are driven by a supervisor on an interval rather than by
// the connection's own events alone. The events are still what carry the facts,
// but they are not enough on their own to decide anything: PeerJS can leave a
// peer unregistered with no event to say so, a WebRTC channel can die silently
// when a device sleeps, and one underlying failure routinely fires three or four
// events at once. A poll that reads the current state cannot miss those, and it
// is single-flight by construction — which is the property that matters, because
// the broker's rate limit is per IP and every player behind one hotspot shares
// one.

import { peerOptions, policyForAttempt } from './iceConfig'
import { controlMessage, readMessage, wrapSnapshot, type PlayerSnapshot } from './projection'

type PeerCtor = typeof import('peerjs').default
type PeerInstance = InstanceType<PeerCtor>
type Conn = import('peerjs').DataConnection

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

/** Whether a string could be a join code at all, for the code-entry field. */
export function isJoinCode(code: string): boolean {
  const upper = code.toUpperCase()
  return upper.length === 6 && [...upper].every((c) => CODE_ALPHABET.includes(c))
}

const BROADCAST_CHANNEL = '5eCombatTool-player-view'

/** How often each supervisor re-reads the state of the connection it owns. */
export const SUPERVISE_MS = 1000
/** Registering the host id is the one step the DM waits on. */
const START_TIMEOUT_MS = 10_000
/** A dial with no open data channel by now is not going to produce one. */
const DIAL_TIMEOUT_MS = 12_000
/** How long a viewer keeps believing a channel that has gone quiet. */
export const STALE_MS = 20_000
/**
 * How long a channel has to last before it counts as a success rather than a
 * flap. Until it does, the attempt counter keeps climbing — a link that connects
 * and dies a second later must not reset the backoff to its floor, or it dials
 * once a second for ever and walks straight back into the per-IP rate limit this
 * whole supervisor exists to stay clear of.
 */
export const STABLE_MS = 10_000
/**
 * Re-registering under a fresh code is a last resort: it invalidates the QR the
 * DM has already shown the table. Give the broker this many tries to reap the
 * socket holding our own id first.
 */
const STALE_ID_LIMIT = 3
/** Long enough for a goodbye to leave the wire before the peer is destroyed. */
const BYE_FLUSH_MS = 250

/** 1s, 2s, 4s, 8s, then 15s — the ceiling the viewer's copy was written for. */
function backoff(attempt: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4))
}

/**
 * A device that was asleep wakes holding a connection that may already be dead
 * and a backoff that elapsed while nothing was scheduled to notice. iOS suspends
 * the whole tab, so coming back has to verify rather than assume.
 *
 * These hooks only exist in a browser; the suites run in node.
 */
function onWake(handler: () => void): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  document.addEventListener('visibilitychange', handler)
  window.addEventListener('online', handler)
  return () => {
    document.removeEventListener('visibilitychange', handler)
    window.removeEventListener('online', handler)
  }
}

export interface HostTransport {
  /** Send a snapshot to all connected viewers. */
  send(snapshot: PlayerSnapshot): void
  /** Send a liveness beat; see `ControlMessage` in ./projection. */
  beat(): void
  stop(): void
}

export type ViewerStatus = 'connecting' | 'connected' | 'reconnecting' | 'ended'

/**
 * Why a viewer is not connected. The remedies differ enough that one message
 * cannot serve them: a player whose DM has not started the session needs to be
 * told to ask, and one behind a network that drops every candidate needs to be
 * told to try another.
 */
export type ViewerFailure = 'broker' | 'no-session' | 'network' | 'stalled'

export interface ViewerHandlers {
  onSnapshot(snapshot: PlayerSnapshot): void
  onStatus(status: ViewerStatus, failure?: ViewerFailure): void
  /** The host speaks a protocol this build cannot read, or vice versa. The
   *  connection is fine — reconnecting will not help, so the viewer says which
   *  side is behind instead of retrying silently. */
  onProtocolMismatch?(theirs: number, ours: number): void
}

export interface ViewerTransport {
  close(): void
  /** Reconnect immediately instead of waiting out the backoff. A player at a
   *  table whose signal came back should not have to sit through 15 seconds. */
  retryNow(): void
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
    beat() {
      channel.postMessage(controlMessage('ping'))
    },
    stop() {
      // Ending is not losing — the same reason the peer host says goodbye.
      channel.postMessage(controlMessage('bye'))
      // Let the posted message have its turn before the port goes away.
      setTimeout(() => channel.close(), 0)
    },
  }
}

export function connectBroadcastViewer(handlers: ViewerHandlers): ViewerTransport {
  const channel = new BroadcastChannel(BROADCAST_CHANNEL)
  let ended = false
  let closed = false
  let reported = false
  let status: ViewerStatus = 'connecting'
  let failure: ViewerFailure | null = null
  let lastMessageAt = Date.now()
  let sawBeat = false

  const report = (next: ViewerStatus, nextFailure?: ViewerFailure) => {
    const f = nextFailure ?? null
    if (reported && status === next && failure === f) return
    reported = true
    status = next
    failure = f
    handlers.onStatus(next, nextFailure)
  }

  const hello = () => channel.postMessage('hello')

  report('connecting')
  channel.onmessage = (event) => {
    const msg = readMessage(event.data)
    lastMessageAt = Date.now()
    if (msg.kind === 'snapshot') {
      report('connected')
      handlers.onSnapshot(msg.snapshot)
    } else if (msg.kind === 'ping') {
      sawBeat = true
      report('connected')
    } else if (msg.kind === 'bye') {
      ended = true
      report('ended')
    } else if (msg.kind === 'mismatch') {
      report('connected')
      handlers.onProtocolMismatch?.(msg.theirs, msg.ours)
    }
  }
  hello()

  // Nobody answers a channel with no DM app behind it, and sitting on
  // "connecting" for ever is the state that looks most like a crash. So keep
  // asking — and once a host has proved that it beats, notice when it stops.
  const supervisor = setInterval(() => {
    if (ended || closed) return
    const quiet = Date.now() - lastMessageAt
    if (status === 'connected') {
      if (sawBeat && quiet > STALE_MS) {
        report('reconnecting', 'stalled')
        hello()
      }
      return
    }
    if (quiet >= DIAL_TIMEOUT_MS) {
      // Whatever went wrong first is still the best explanation available.
      report('reconnecting', failure ?? 'no-session')
      hello()
    }
  }, SUPERVISE_MS)

  const stopWaking = onWake(() => {
    if (!ended && !closed) hello()
  })

  return {
    close() {
      closed = true
      clearInterval(supervisor)
      stopWaking()
      channel.close()
    },
    retryNow() {
      // Nothing to reconnect on a same-origin channel — just re-ask the host
      // for the current state.
      if (!closed) hello()
    },
  }
}

// ---------- PeerJS (remote viewers) ----------

export type HostStatus = 'live' | 'reconnecting' | 'offline'

export interface HostDiagnostics {
  status: HostStatus
  detail: string
  code: string
  /** One entry per connected viewer: how its data is actually travelling. */
  viewers: string[]
  lastSentAt: number | null
}

export interface PeerHostSession extends HostTransport {
  readonly code: string
  onViewerCount(cb: (count: number) => void): void
  onStatus(cb: (status: HostStatus, detail: string) => void): void
  diagnostics(): Promise<HostDiagnostics>
}

interface CandidateStat {
  candidateType?: string
}

interface PairStat {
  id?: string
  type?: string
  state?: string
  selected?: boolean
  nominated?: boolean
  localCandidateId?: string
  remoteCandidateId?: string
  selectedCandidatePairId?: string
}

/**
 * Which kind of candidate pair is actually carrying a viewer.
 *
 * This is the one line that turns "it doesn't work" into an answer a DM can act
 * on: `relayed` proves the relay is doing its job on a network that forbids
 * direct paths, `direct` proves it was never needed, and `negotiating` that
 * stays put proves the network dropped every candidate there was.
 */
async function describePath(pc: RTCPeerConnection | undefined): Promise<string> {
  if (!pc || typeof pc.getStats !== 'function') return 'unknown'
  try {
    const stats = await pc.getStats()
    const reports = [...stats.values()] as PairStat[]
    const selectedId = reports.find((r) => r.type === 'transport' && r.selectedCandidatePairId)?.selectedCandidatePairId
    for (const report of reports) {
      if (report.type !== 'candidate-pair') continue
      // Safari does not publish `transport.selectedCandidatePairId`, so fall
      // back to whichever pair reports itself nominated and succeeded.
      const chosen =
        report.id === selectedId || report.selected === true || (report.nominated === true && report.state === 'succeeded')
      if (!chosen) continue
      const local = stats.get(report.localCandidateId ?? '') as CandidateStat | undefined
      const remote = stats.get(report.remoteCandidateId ?? '') as CandidateStat | undefined
      if (local?.candidateType === 'relay' || remote?.candidateType === 'relay') return 'relayed'
      if (local?.candidateType === 'host' && remote?.candidateType === 'host') return 'direct, same network'
      return 'direct, through NAT'
    }
    return 'negotiating'
  } catch {
    return 'unknown'
  }
}

class PeerHost implements PeerHostSession {
  private Peer: PeerCtor
  private peer: PeerInstance
  private connections = new Set<Conn>()
  private last: PlayerSnapshot | null = null
  private notifyCount: (count: number) => void = () => {}
  private notifyStatus: (status: HostStatus, detail: string) => void = () => {}
  private supervisor: ReturnType<typeof setInterval> | undefined
  private stopWaking: () => void = () => {}
  private stopped = false
  private fatal = false
  private attempts = 0
  private staleIdAttempts = 0
  private nextAttemptAt = 0
  private status: HostStatus = 'reconnecting'
  private detail = ''
  code: string
  private lastSentAt: number | null = null

  constructor(ctor: PeerCtor, code: string) {
    this.Peer = ctor
    this.code = code
    this.peer = this.build()
  }

  private build(): PeerInstance {
    const peer = new this.Peer(peerIdForCode(this.code), peerOptions())
    peer.on('open', () => {
      this.attempts = 0
      this.staleIdAttempts = 0
      this.report('live')
    })
    peer.on('connection', (conn) => this.accept(conn))
    peer.on('disconnected', () => {
      // Routine on mobile: an idle tab, a cell handover, the broker restarting.
      // The channels to viewers already watching are untouched — but until the
      // id is registered again a player scanning the QR gets nothing at all, and
      // before this the app never noticed. The DM saw a healthy session that
      // nobody new could join, forever.
      if (!this.stopped) this.report('reconnecting', 'the join server dropped the connection')
    })
    peer.on('close', () => {
      if (!this.stopped) this.report('offline', 'the join server closed the connection')
    })
    peer.on('error', (err) => this.onError(err))
    return peer
  }

  private accept(conn: Conn): void {
    conn.on('open', () => {
      this.connections.add(conn)
      this.notifyCount(this.connections.size)
      // a (re)connecting viewer is current after one message
      if (this.last) conn.send(wrapSnapshot(this.last))
    })
    const drop = () => {
      if (!this.connections.delete(conn)) return
      this.notifyCount(this.connections.size)
    }
    conn.on('close', drop)
    conn.on('error', drop)
  }

  private onError(err: Error & { type?: string }): void {
    if (this.stopped) return
    switch (err.type) {
      // Fatal: no amount of retrying changes the browser, the id or the key, so
      // say it once rather than looping behind a "reconnecting" label.
      case 'browser-incompatible':
      case 'invalid-id':
      case 'invalid-key':
      case 'ssl-unavailable':
        this.fatal = true
        this.report('offline', err.message)
        return
      case 'unavailable-id':
        // Almost always our own previous socket: the broker has not yet reaped
        // the registration this peer held before it dropped. Waiting is the fix.
        // Taking a fresh code straight away would invalidate the QR already on
        // the table, so that only happens once waiting has failed.
        this.staleIdAttempts += 1
        this.report('reconnecting', 'the join server is still holding the previous session')
        return
      default:
        // network, server-error, socket-error, socket-closed, webrtc
        this.report('reconnecting', err.message)
    }
  }

  /** Waits for the broker to register this peer's id, or to refuse it. */
  private awaitRegistration(): Promise<'open' | 'id-taken' | 'failed'> {
    const peer = this.peer
    return new Promise((resolve) => {
      let settled = false
      const finish = (outcome: 'open' | 'id-taken' | 'failed') => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        peer.off('open', onOpen)
        peer.off('error', onError)
        resolve(outcome)
      }
      const onOpen = () => finish('open')
      const onError = (err: Error & { type?: string }) => finish(err.type === 'unavailable-id' ? 'id-taken' : 'failed')
      const timer = setTimeout(() => finish('failed'), START_TIMEOUT_MS)
      peer.on('open', onOpen)
      peer.on('error', onError)
    })
  }

  /**
   * Registering the id is the one step whose failure the DM has to see before
   * the dialog claims a session exists. Everything after it is recoverable in
   * the background, which is what the supervisor is for.
   */
  async start(): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      const outcome = await this.awaitRegistration()
      if (outcome === 'open') break
      // A six-character code collided with a live session. A fresh one is free
      // before anybody has seen it — unlike later, with the QR on the table.
      if (outcome === 'id-taken' && attempt < STALE_ID_LIMIT) {
        this.rebuild(true)
        continue
      }
      throw new Error(this.detail || 'the join server did not answer')
    }
    this.supervisor = setInterval(() => this.check(), SUPERVISE_MS)
    this.stopWaking = onWake(() => this.check())
  }

  /**
   * The broker socket is read on a timer, not trusted to announce itself. PeerJS
   * emits 'disconnected' reliably enough, but a `reconnect()` that quietly fails
   * to take leaves no event behind — and an unregistered host is exactly the
   * failure a DM cannot see, because everyone already watching keeps working
   * while nobody new can join.
   */
  check(): void {
    if (this.stopped || this.fatal) return
    if (this.peer.destroyed) {
      this.rebuild(this.staleIdAttempts > STALE_ID_LIMIT)
      return
    }
    if (!this.peer.disconnected) {
      this.attempts = 0
      this.staleIdAttempts = 0
      this.report('live')
      return
    }
    if (Date.now() < this.nextAttemptAt) return
    this.nextAttemptAt = Date.now() + backoff(this.attempts)
    this.attempts += 1
    if (this.staleIdAttempts > STALE_ID_LIMIT) {
      this.rebuild(true)
      return
    }
    this.report('reconnecting', this.detail)
    try {
      this.peer.reconnect()
    } catch {
      // reconnect() throws on a destroyed peer; the next tick rebuilds it.
      this.rebuild(false)
    }
  }

  /**
   * Replaces the peer wholesale. This costs every viewer their data channel, so
   * it is the last resort — but a destroyed peer can neither reconnect nor
   * accept anyone, and keeping it costs them the session instead.
   */
  private rebuild(freshCode: boolean): void {
    if (this.stopped) return
    this.peer.removeAllListeners()
    if (!this.peer.destroyed) this.peer.destroy()
    if (freshCode) {
      this.code = generateJoinCode()
      this.staleIdAttempts = 0
    }
    if (this.connections.size > 0) {
      this.connections.clear()
      this.notifyCount(0)
    }
    this.report('reconnecting', this.detail)
    this.peer = this.build()
  }

  private report(status: HostStatus, detail = ''): void {
    if (this.status === status && this.detail === detail) return
    this.status = status
    this.detail = detail
    this.notifyStatus(status, detail)
  }

  send(snapshot: PlayerSnapshot): void {
    this.last = snapshot
    const message = wrapSnapshot(snapshot)
    let sent = 0
    for (const c of this.connections) {
      if (!c.open) continue
      c.send(message)
      sent += 1
    }
    if (sent > 0) this.lastSentAt = Date.now()
  }

  beat(): void {
    const message = controlMessage('ping')
    for (const c of this.connections) if (c.open) c.send(message)
  }

  onViewerCount(cb: (count: number) => void): void {
    this.notifyCount = cb
    cb(this.connections.size)
  }

  onStatus(cb: (status: HostStatus, detail: string) => void): void {
    this.notifyStatus = cb
    cb(this.status, this.detail)
  }

  async diagnostics(): Promise<HostDiagnostics> {
    const viewers = await Promise.all([...this.connections].map((c) => describePath(c.peerConnection)))
    return { status: this.status, detail: this.detail, code: this.code, viewers, lastSentAt: this.lastSentAt }
  }

  stop(): void {
    this.stopped = true
    clearInterval(this.supervisor)
    this.stopWaking()
    const bye = controlMessage('bye')
    for (const c of this.connections) if (c.open) c.send(bye)
    // Destroying the peer in this tick would discard the goodbye along with
    // everything else still buffered, and the goodbye is the last thing that
    // will ever travel on these channels.
    setTimeout(() => {
      for (const c of this.connections) c.close()
      this.connections.clear()
      this.peer.destroy()
    }, BYE_FLUSH_MS)
    this.notifyCount(0)
  }
}

/** Hosts a PeerJS session; resolves once the broker registers the id. */
export async function startPeerHost(code: string): Promise<PeerHostSession> {
  const { default: Peer } = await import('peerjs')
  const host = new PeerHost(Peer, code)
  try {
    await host.start()
  } catch (err) {
    // Nothing is watching a session that never started, so it must not be left
    // holding a socket to the broker.
    host.stop()
    throw err
  }
  return host
}

function classifyViewerError(err: Error & { type?: string }): ViewerFailure {
  if (err.type === 'peer-unavailable') return 'no-session'
  if (err.type === 'webrtc') return 'network'
  return 'broker'
}

class PeerViewer implements ViewerTransport {
  private Peer: PeerCtor | null = null
  private code: string
  private handlers: ViewerHandlers
  private peer: PeerInstance | null = null
  private conn: Conn | null = null
  private generation = 0
  private closed = false
  private ended = false
  private attempts = 0
  private nextAttemptAt = 0
  private lastMessageAt = 0
  private connectedAt = 0
  private sawBeat = false
  private supervisor: ReturnType<typeof setInterval> | undefined
  private stopWaking: () => void = () => {}
  private status: ViewerStatus = 'connecting'
  private failure: ViewerFailure | null = null
  private reported = false

  constructor(code: string, handlers: ViewerHandlers) {
    this.code = code
    this.handlers = handlers
  }

  async start(): Promise<void> {
    const { default: Peer } = await import('peerjs')
    if (this.closed) return
    this.Peer = Peer
    this.dial()
    this.supervisor = setInterval(() => this.check(), SUPERVISE_MS)
    this.stopWaking = onWake(() => this.check())
  }

  private dial(): void {
    this.teardown()
    const Peer = this.Peer
    if (this.closed || this.ended || !Peer) return

    const mine = this.generation
    const attempt = this.attempts
    this.attempts += 1
    // A dial that has not opened a channel by then is retried, which is what
    // makes a silent ICE failure recoverable: it produces no event to wait for.
    this.nextAttemptAt = Date.now() + DIAL_TIMEOUT_MS
    this.report(attempt === 0 ? 'connecting' : 'reconnecting', this.failure ?? undefined)

    // Every callback below belongs to this one attempt. Before the guard, one
    // failure fired four events and each started another attempt; the resulting
    // storm of peers is what the broker's per-IP rate limit sees, which is how
    // one hotspot's blip used to become a table that could not connect at all.
    const current = () => mine === this.generation && !this.closed && !this.ended

    const peer = new Peer(peerOptions(policyForAttempt(attempt)))
    this.peer = peer

    peer.on('open', () => {
      if (!current()) return
      const conn = peer.connect(peerIdForCode(this.code), { reliable: true })
      this.conn = conn
      conn.on('open', () => {
        if (!current()) return
        this.lastMessageAt = Date.now()
        this.connectedAt = Date.now()
        // The attempt counter is deliberately not cleared here. Opening is not
        // yet success — see STABLE_MS.
        this.report('connected')
      })
      conn.on('data', (data) => {
        if (!current()) return
        this.lastMessageAt = Date.now()
        this.receive(data)
      })
      conn.on('close', () => {
        if (current()) this.fail('network')
      })
      conn.on('error', () => {
        if (current()) this.fail('network')
      })
    })

    peer.on('disconnected', () => {
      if (!current() || peer.destroyed) return
      // The broker socket, not the data channel. The channel may be carrying
      // snapshots right now — tearing the peer down here is what used to drop
      // working connections on every routine network hiccup.
      peer.reconnect()
    })

    peer.on('error', (err) => {
      if (!current()) return
      // A broker error while the channel is open is noise: the channel carries
      // the battle, the socket was only needed to set it up.
      if (this.conn?.open) return
      this.fail(classifyViewerError(err))
    })
  }

  private fail(failure: ViewerFailure): void {
    if (this.closed || this.ended) return
    this.nextAttemptAt = Date.now() + backoff(this.attempts)
    this.report('reconnecting', failure)
    this.teardown()
  }

  /** Ends the current attempt. Anything still in flight belongs to a past one. */
  private teardown(): void {
    this.generation += 1
    const { peer, conn } = this
    this.conn = null
    this.peer = null
    conn?.removeAllListeners()
    peer?.removeAllListeners()
    peer?.destroy()
  }

  check(): void {
    if (this.closed || this.ended) return
    if (this.conn?.open) {
      // Liveness, but only against a host that has proved it sends beats. A DM
      // still on an older build never will, and tearing down a healthy channel
      // over that would be a regression rather than a fix.
      if (this.sawBeat && Date.now() - this.lastMessageAt > STALE_MS) this.fail('stalled')
      else if (this.attempts > 0 && Date.now() - this.connectedAt >= STABLE_MS) this.attempts = 0
      return
    }
    if (Date.now() >= this.nextAttemptAt) this.dial()
  }

  private receive(data: unknown): void {
    const msg = readMessage(data)
    switch (msg.kind) {
      case 'snapshot':
        this.report('connected')
        this.handlers.onSnapshot(msg.snapshot)
        return
      case 'ping':
        this.sawBeat = true
        this.report('connected')
        return
      case 'bye':
        this.ended = true
        this.report('ended')
        this.teardown()
        clearInterval(this.supervisor)
        return
      case 'mismatch':
        // The link works, so this is not a retry case at all — the channel stays
        // up and lets the viewer explain itself.
        this.report('connected')
        this.handlers.onProtocolMismatch?.(msg.theirs, msg.ours)
        return
      case 'ignore':
        return
    }
  }

  private report(status: ViewerStatus, failure?: ViewerFailure): void {
    const next = failure ?? null
    if (this.reported && this.status === status && this.failure === next) return
    this.reported = true
    this.status = status
    this.failure = next
    this.handlers.onStatus(status, failure)
  }

  close(): void {
    this.closed = true
    clearInterval(this.supervisor)
    this.stopWaking()
    this.teardown()
    this.handlers.onStatus('ended')
  }

  retryNow(): void {
    if (this.closed || this.ended) return
    // Keep `attempts` so the copy stays "reconnecting" rather than reverting to
    // the first-time "connecting", and so the transport policy keeps escalating.
    this.nextAttemptAt = 0
    this.dial()
  }
}

/** Connects a viewer to a host code; retries with backoff until closed. */
export function connectPeerViewer(code: string, handlers: ViewerHandlers): ViewerTransport {
  const viewer = new PeerViewer(code, handlers)
  void viewer.start()
  return viewer
}
