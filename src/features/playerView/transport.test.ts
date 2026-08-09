import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeConnection, FakePeer } from '../../test/fakePeer'
import { controlMessage, wrapSnapshot, type PlayerSnapshot } from './projection'
import {
  connectBroadcastViewer,
  connectPeerViewer,
  generateJoinCode,
  isJoinCode,
  peerIdForCode,
  STALE_MS,
  startBroadcastHost,
  startPeerHost,
  SUPERVISE_MS,
  type ViewerFailure,
  type ViewerStatus,
} from './transport'

vi.mock('peerjs', async () => {
  const { FakePeer: Fake } = await import('../../test/fakePeer')
  return { default: Fake }
})

const snapshot: PlayerSnapshot = {
  round: 2,
  isRunning: true,
  activeId: 'a',
  participants: [
    {
      id: 'a',
      name: 'Goblin',
      isPC: false,
      health: { kind: 'npc', status: 'Bloodied' },
      conditions: [],
    },
  ],
}

describe('generateJoinCode', () => {
  it('produces 6 chars from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode()
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/)
      expect(code).not.toMatch(/[01OIL]/)
    }
  })

  it('namespaces the peer id', () => {
    expect(peerIdForCode('abc234')).toBe('5eBattleTracker-ABC234')
  })

  it('accepts what it generates and rejects the ambiguous characters', () => {
    for (let i = 0; i < 20; i++) expect(isJoinCode(generateJoinCode())).toBe(true)
    expect(isJoinCode('abc234')).toBe(true) // typed in either case
    expect(isJoinCode('ABC23')).toBe(false) // too short
    expect(isJoinCode('ABC2340')).toBe(false) // too long
    expect(isJoinCode('ABC23O')).toBe(false) // O is never in a code
  })
})

describe('BroadcastChannel transport', () => {
  it('delivers snapshots from host to viewer', async () => {
    const host = startBroadcastHost()
    const received = vi.fn()
    const statuses: string[] = []
    const viewer = connectBroadcastViewer({
      onSnapshot: received,
      onStatus: (s) => statuses.push(s),
    })
    try {
      host.send(snapshot)
      await vi.waitFor(() => expect(received).toHaveBeenCalled())
      expect(received.mock.lastCall?.[0]).toEqual(snapshot)
      expect(statuses).toContain('connected')
    } finally {
      viewer.close()
      host.stop()
    }
  })

  it('serves the current state to late-joining viewers', async () => {
    const host = startBroadcastHost()
    host.send(snapshot)
    const received = vi.fn()
    const viewer = connectBroadcastViewer({ onSnapshot: received, onStatus: () => {} })
    try {
      await vi.waitFor(() => expect(received).toHaveBeenCalled())
      expect(received.mock.lastCall?.[0]).toEqual(snapshot)
    } finally {
      viewer.close()
      host.stop()
    }
  })

  it('ends the viewer when the host says goodbye', async () => {
    const host = startBroadcastHost()
    const statuses: ViewerStatus[] = []
    const viewer = connectBroadcastViewer({ onSnapshot: () => {}, onStatus: (s) => statuses.push(s) })
    try {
      host.send(snapshot)
      await vi.waitFor(() => expect(statuses).toContain('connected'))
      host.stop()
      // Ending is not losing: the viewer must not fall into the retry loop.
      await vi.waitFor(() => expect(statuses.at(-1)).toBe('ended'))
    } finally {
      viewer.close()
    }
  })
})

// ---------- PeerJS ----------

const flush = () => vi.advanceTimersByTimeAsync(0)

function recorder() {
  const statuses: [ViewerStatus, ViewerFailure | undefined][] = []
  const snapshots: PlayerSnapshot[] = []
  return {
    statuses,
    snapshots,
    handlers: {
      onSnapshot: (s: PlayerSnapshot) => snapshots.push(s),
      onStatus: (s: ViewerStatus, f?: ViewerFailure) => statuses.push([s, f]),
    },
  }
}

/** A host whose id the broker has accepted. */
async function startedHost(code = 'ABC234') {
  const pending = startPeerHost(code)
  await flush()
  FakePeer.last().openBroker()
  return await pending
}

/** A viewer with an open data channel to a host. */
async function connectedViewer(code = 'ABC234') {
  const rec = recorder()
  const transport = connectPeerViewer(code, rec.handlers)
  await flush()
  const peer = FakePeer.last()
  peer.openBroker()
  const conn = peer.connections[0]
  conn.accept()
  return { ...rec, transport, peer, conn }
}

describe('PeerJS host', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakePeer.reset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('configures a relay reachable on 443, not only PeerJS’s 3478 default', async () => {
    const host = await startedHost()
    try {
      const urls = (FakePeer.last().options.config?.iceServers ?? []).flatMap((s) =>
        typeof s.urls === 'string' ? [s.urls] : s.urls,
      )
      expect(urls.some((u) => u.startsWith('turns:') && u.includes(':443'))).toBe(true)
      expect(urls.some((u) => u.includes('443?transport=tcp'))).toBe(true)
    } finally {
      host.stop()
    }
  })

  it('re-registers with the broker instead of leaving the session unjoinable', async () => {
    const host = await startedHost()
    const peer = FakePeer.last()
    const seen: string[] = []
    host.onStatus((status) => seen.push(status))
    expect(seen).toEqual(['live'])

    try {
      // The routine mobile failure: the socket drops while the data channels to
      // everyone already watching stay up.
      peer.dropBroker()
      await vi.advanceTimersByTimeAsync(SUPERVISE_MS + 100)

      expect(peer.reconnectCount).toBe(1)
      // Nobody watching loses their channel over a signalling hiccup.
      expect(peer.destroyed).toBe(false)
      expect(seen).toContain('reconnecting')
    } finally {
      host.stop()
    }
  })

  it('keeps retrying the broker on a schedule rather than once', async () => {
    const host = await startedHost()
    const peer = FakePeer.last()
    try {
      peer.dropBroker()
      // 1s, then 2s, then 4s: three attempts inside the first eight seconds.
      await vi.advanceTimersByTimeAsync(8000)
      expect(peer.reconnectCount).toBeGreaterThanOrEqual(3)
    } finally {
      host.stop()
    }
  })

  it('takes a fresh code when the broker says the first one is taken', async () => {
    const pending = startPeerHost('ABC234')
    await flush()
    expect(FakePeer.last().id).toBe(peerIdForCode('ABC234'))

    FakePeer.last().failWith('unavailable-id')
    await flush()
    expect(FakePeer.instances).toHaveLength(2)

    FakePeer.last().openBroker()
    const host = await pending
    try {
      expect(host.code).not.toBe('ABC234')
      expect(FakePeer.last().id).toBe(peerIdForCode(host.code))
    } finally {
      host.stop()
    }
  })

  it('reports a fatal error instead of hiding it behind a reconnect loop', async () => {
    const pending = startPeerHost('ABC234')
    await flush()
    FakePeer.last().failWith('browser-incompatible', 'no WebRTC here')
    await expect(pending).rejects.toThrow('no WebRTC here')
  })

  it('says goodbye before dropping its viewers', async () => {
    const host = await startedHost()
    const peer = FakePeer.last()
    const conn = new FakeConnection('viewer-1')
    peer.emit('connection', conn)
    conn.accept()

    const counts: number[] = []
    host.onViewerCount((n) => counts.push(n))
    expect(counts).toEqual([1])

    host.send(snapshot)
    expect(conn.sent.at(-1)).toEqual(wrapSnapshot(snapshot))

    host.stop()
    expect(conn.sent.at(-1)).toEqual(controlMessage('bye'))
    // The channel is only torn down once the goodbye has had a chance to leave.
    expect(conn.closed).toBe(false)
    await vi.advanceTimersByTimeAsync(500)
    expect(conn.closed).toBe(true)
  })

  it('beats so a viewer can tell a quiet battle from a dead channel', async () => {
    const host = await startedHost()
    const peer = FakePeer.last()
    const conn = new FakeConnection('viewer-1')
    peer.emit('connection', conn)
    conn.accept()
    try {
      host.beat()
      expect(conn.sent.at(-1)).toEqual(controlMessage('ping'))
    } finally {
      host.stop()
    }
  })
})

describe('PeerJS viewer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakePeer.reset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers snapshots once the channel is open', async () => {
    const { conn, snapshots, statuses, transport } = await connectedViewer()
    try {
      conn.deliver(wrapSnapshot(snapshot))
      expect(snapshots).toEqual([snapshot])
      expect(statuses.map(([s]) => s)).toEqual(['connecting', 'connected'])
    } finally {
      transport.close()
    }
  })

  it('starts exactly one new attempt when a single fault fires every event', async () => {
    const { conn, peer, transport } = await connectedViewer()
    try {
      // How a real failure arrives: four events for one underlying cause. Each
      // used to start its own attempt, and the resulting storm of peers is what
      // the broker's per-IP rate limit sees — which is how one hotspot's blip
      // became a table that could not connect at all.
      conn.emit('error', new Error('ice failed'))
      conn.emit('close')
      peer.failWith('network')
      peer.dropBroker()
      await flush()

      expect(FakePeer.instances).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1100)
      expect(FakePeer.instances).toHaveLength(2)
    } finally {
      transport.close()
    }
  })

  it('reconnects the broker socket without disturbing a working channel', async () => {
    const { conn, peer, statuses, transport } = await connectedViewer()
    try {
      conn.deliver(wrapSnapshot(snapshot))
      // PeerJS emits this whenever the signalling socket closes, which is
      // routine — while the data channel carrying the battle is untouched.
      peer.dropBroker()
      await vi.advanceTimersByTimeAsync(SUPERVISE_MS + 100)

      expect(peer.reconnectCount).toBe(1)
      expect(peer.destroyed).toBe(false)
      expect(FakePeer.instances).toHaveLength(1)
      expect(statuses.map(([s]) => s)).not.toContain('reconnecting')
    } finally {
      transport.close()
    }
  })

  it('forces a relay on the attempt after a failure', async () => {
    const rec = recorder()
    const transport = connectPeerViewer('ABC234', rec.handlers)
    await flush()
    try {
      const first = FakePeer.last()
      expect(first.options.config?.iceTransportPolicy).toBe('all')

      first.failWith('network')
      await vi.advanceTimersByTimeAsync(2100)

      const second = FakePeer.last()
      expect(second).not.toBe(first)
      // A network that drops every direct candidate needs the relay tried on
      // its own, without ICE settling for a pair that only half-works.
      expect(second.options.config?.iceTransportPolicy).toBe('relay')
    } finally {
      transport.close()
    }
  })

  it('rebuilds a channel that stopped beating', async () => {
    const { conn, peer, statuses, transport } = await connectedViewer()
    try {
      conn.deliver(controlMessage('ping'))
      await vi.advanceTimersByTimeAsync(STALE_MS + SUPERVISE_MS + 100)

      // The channel never closed and never errored — the beats simply stopped,
      // which is what a slept iPad leaves behind and what nothing used to catch.
      expect(peer.destroyed).toBe(true)
      expect(statuses.at(-1)).toEqual(['reconnecting', 'stalled'])
      expect(FakePeer.instances).toHaveLength(1)

      // and then it dials again, once the backoff is up
      await vi.advanceTimersByTimeAsync(2000)
      expect(FakePeer.instances).toHaveLength(2)
    } finally {
      transport.close()
    }
  })

  it('leaves a quiet channel alone when the host never beat', async () => {
    const { conn, peer, transport } = await connectedViewer()
    try {
      // A DM one release behind sends snapshots but no beats. Tearing this
      // channel down would be a regression, not a fix.
      conn.deliver(wrapSnapshot(snapshot))
      await vi.advanceTimersByTimeAsync(STALE_MS * 3)

      expect(peer.destroyed).toBe(false)
      expect(FakePeer.instances).toHaveLength(1)
    } finally {
      transport.close()
    }
  })

  it('ends instead of retrying when the host says goodbye', async () => {
    const { conn, statuses, transport } = await connectedViewer()
    try {
      conn.deliver(controlMessage('bye'))
      expect(statuses.at(-1)?.[0]).toBe('ended')

      await vi.advanceTimersByTimeAsync(60_000)
      expect(FakePeer.instances).toHaveLength(1)
    } finally {
      transport.close()
    }
  })

  it('names a missing session rather than calling it a lost connection', async () => {
    const rec = recorder()
    const transport = connectPeerViewer('ABC234', rec.handlers)
    await flush()
    try {
      FakePeer.last().failWith('peer-unavailable')
      await flush()
      // The DM has not started the session, or the code is wrong. Neither is
      // fixed by waiting, so the copy has to say which to go and check.
      expect(rec.statuses.at(-1)).toEqual(['reconnecting', 'no-session'])
    } finally {
      transport.close()
    }
  })

  it('stops dialling once closed', async () => {
    const { transport } = await connectedViewer()
    transport.close()
    const built = FakePeer.instances.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(FakePeer.instances).toHaveLength(built)
  })
})
