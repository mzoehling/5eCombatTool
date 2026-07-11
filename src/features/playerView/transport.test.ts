import { describe, expect, it, vi } from 'vitest'
import type { PlayerSnapshot } from './projection'
import { connectBroadcastViewer, generateJoinCode, peerIdForCode, startBroadcastHost } from './transport'

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
})
