// A stand-in for PeerJS, small enough to drive a connection through every state
// the transport has to survive: a broker socket that drops, an id the server will
// not give back, a data channel that goes quiet without closing, and one failure
// arriving as four events at once.
//
// The suites run in node with no WebRTC, so nothing here negotiates anything —
// the point is the state machine around the connection, which is where the bugs
// were.

type Handler = (arg?: never) => void

class FakeEmitter {
  private handlers = new Map<string, Set<Handler>>()

  on(event: string, cb: Handler): this {
    const set = this.handlers.get(event) ?? new Set<Handler>()
    set.add(cb)
    this.handlers.set(event, set)
    return this
  }

  off(event: string, cb: Handler): this {
    this.handlers.get(event)?.delete(cb)
    return this
  }

  removeAllListeners(): this {
    this.handlers.clear()
    return this
  }

  /** Fires an event, over a copy: handlers routinely detach themselves. */
  emit(event: string, arg?: unknown): void {
    for (const cb of [...(this.handlers.get(event) ?? [])]) (cb as (a?: unknown) => void)(arg)
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0
  }
}

export class FakeConnection extends FakeEmitter {
  readonly peer: string
  open = false
  closed = false
  sent: unknown[] = []
  peerConnection: RTCPeerConnection | undefined = undefined

  constructor(peer: string) {
    super()
    this.peer = peer
  }

  send(data: unknown): void {
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
    this.open = false
    this.emit('close')
  }

  // ---- test controls ----

  /** The data channel comes up. */
  accept(): void {
    this.open = true
    this.emit('open')
  }

  /** A message arrives from the other end. */
  deliver(data: unknown): void {
    this.emit('data', data)
  }
}

export class FakePeer extends FakeEmitter {
  static instances: FakePeer[] = []

  static reset(): void {
    FakePeer.instances = []
  }

  static last(): FakePeer {
    const peer = FakePeer.instances.at(-1)
    if (!peer) throw new Error('no FakePeer has been constructed')
    return peer
  }

  readonly id: string | undefined
  readonly options: { config?: RTCConfiguration } & Record<string, unknown>
  destroyed = false
  /**
   * Faithful to real PeerJS, and the detail that matters most here: a peer that
   * has only just been constructed is NOT `disconnected` — it is *connecting*,
   * with `open` still false. Starting this at `true` is what hid a host that
   * called itself live while it was unregistered.
   */
  disconnected = false
  open = false
  reconnectCount = 0
  connections: FakeConnection[] = []

  constructor(idOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) {
    super()
    if (typeof idOrOptions === 'string') {
      this.id = idOrOptions
      this.options = options ?? {}
    } else {
      this.options = idOrOptions ?? {}
    }
    FakePeer.instances.push(this)
  }

  connect(peerId: string): FakeConnection {
    const conn = new FakeConnection(peerId)
    this.connections.push(conn)
    return conn
  }

  /**
   * Real `reconnect()` only re-opens the socket; the broker's answer arrives
   * later as another `open`. So this leaves the peer *connecting*, and a test
   * decides what comes back with `openBroker()` or `dropBroker()`.
   */
  reconnect(): void {
    if (this.destroyed) throw new Error('cannot reconnect a destroyed peer')
    this.reconnectCount += 1
    this.disconnected = false
  }

  destroy(): void {
    this.destroyed = true
    this.disconnected = true
    this.open = false
    this.emit('close')
  }

  // ---- test controls ----

  /**
   * The broker registers this peer's id. PeerJS emits `open` every time the
   * server answers — including after each `reconnect()`, not only the first
   * time, which is the behaviour that made the viewer dial twice.
   */
  openBroker(): void {
    this.disconnected = false
    this.open = true
    this.emit('open', this.id)
  }

  /** The broker socket drops, leaving any data channels untouched. */
  dropBroker(): void {
    this.disconnected = true
    this.open = false
    this.emit('disconnected', this.id)
  }

  failWith(type: string, message = type): void {
    this.emit('error', Object.assign(new Error(message), { type }))
  }
}
