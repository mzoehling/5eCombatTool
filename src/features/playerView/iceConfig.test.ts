import { afterEach, describe, expect, it, vi } from 'vitest'
import { brokerOptions, DEFAULT_ICE_SERVERS, iceServers, peerOptions, policyForAttempt } from './iceConfig'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function allUrls(servers: RTCIceServer[]): string[] {
  return servers.flatMap((s) => (typeof s.urls === 'string' ? [s.urls] : s.urls))
}

describe('the built-in ICE servers', () => {
  it('offer a relay on 443 over both TCP and TLS', () => {
    // The whole point of the list: PeerJS's own default is 3478-only, and 3478
    // is exactly what a hotspot or a venue's guest wifi blocks. A relay on 443
    // is what such a network cannot tell from ordinary HTTPS.
    const urls = allUrls(DEFAULT_ICE_SERVERS)
    expect(urls.some((u) => u.startsWith('turns:') && u.includes(':443'))).toBe(true)
    expect(urls.some((u) => u.startsWith('turn:') && u.includes('443?transport=tcp'))).toBe(true)
  })

  it('give every relay a credential', () => {
    for (const server of DEFAULT_ICE_SERVERS) {
      const isRelay = allUrls([server]).some((u) => u.startsWith('turn:') || u.startsWith('turns:'))
      if (isRelay) expect(server.username).toBeTruthy()
    }
  })
})

describe('overrides', () => {
  it('take the configured servers when the JSON is valid', () => {
    const mine = [{ urls: 'turns:turn.example.com:443', username: 'u', credential: 'p' }]
    vi.stubEnv('VITE_ICE_SERVERS', JSON.stringify(mine))
    expect(iceServers()).toEqual(mine)
  })

  it('fall back rather than cost a session', () => {
    // A mistyped environment variable must be a warning in the console, never a
    // table that cannot connect.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubEnv('VITE_ICE_SERVERS', '{not json')
    expect(iceServers()).toBe(DEFAULT_ICE_SERVERS)

    vi.stubEnv('VITE_ICE_SERVERS', '[]')
    expect(iceServers()).toBe(DEFAULT_ICE_SERVERS)

    // One malformed entry makes the whole list suspect: gathering against a
    // half-valid list fails in ways that look like a network fault.
    vi.stubEnv('VITE_ICE_SERVERS', '[{"urls":"stun:a"},{"user":"nope"}]')
    expect(iceServers()).toBe(DEFAULT_ICE_SERVERS)

    expect(warn).toHaveBeenCalled()
  })

  it('leave the broker on the public cloud unless told otherwise', () => {
    expect(brokerOptions()).toEqual({})
    vi.stubEnv('VITE_PEER_SERVER', '{"host":"peer.example.com","port":443,"secure":true}')
    expect(brokerOptions()).toEqual({ host: 'peer.example.com', port: 443, secure: true })
  })
})

describe('peerOptions', () => {
  it('carries sdpSemantics, which PeerJS drops as soon as config is replaced', () => {
    // `config` replaces PeerJS's default wholesale rather than merging into it,
    // so the legacy key has to be restated here or it is silently lost.
    expect(peerOptions().config.sdpSemantics).toBe('unified-plan')
  })

  it('alternates direct and relay-only attempts', () => {
    // Relay-only fails outright when no allocation succeeds, and 'all' can settle
    // on a pair that only half-works — so alternating means a table where either
    // is broken still gets a working attempt every second try.
    expect(policyForAttempt(0)).toBe('all')
    expect(policyForAttempt(1)).toBe('relay')
    expect(policyForAttempt(2)).toBe('all')
    expect(peerOptions(policyForAttempt(1)).config.iceTransportPolicy).toBe('relay')
  })
})
