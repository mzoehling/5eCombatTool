// ICE and signaling configuration for the Player View's WebRTC path.
//
// PeerJS's own defaults are a Google STUN server plus its free relay on port
// 3478, and that is the wrong shape for the networks this app actually meets. A
// phone hotspot and a venue's guest Wi-Fi both isolate their clients from one
// another, and browsers hide local addresses behind mDNS names such networks
// will not resolve — so a relay is usually the only path that can carry a table,
// and 3478 is exactly the port those networks block. Every relay entry below
// reaches the same servers over a port a firewall has to leave open, including
// TLS on 443, which it cannot tell apart from ordinary HTTPS.

/**
 * PeerJS hands its `config` straight to `RTCPeerConnection`, but its own default
 * carries `sdpSemantics` — a legacy Chrome key that is not part of the DOM type.
 * Passing `config` replaces PeerJS's default wholesale rather than merging into
 * it, so the key has to be carried here or it is silently dropped.
 */
export interface PeerRtcConfig extends RTCConfiguration {
  sdpSemantics?: string
}

/** The Open Relay Project's shared credentials; the same pair for every entry. */
const OPEN_RELAY = { username: 'openrelayproject', credential: 'openrelayproject' }

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  { urls: 'turn:openrelay.metered.ca:80', ...OPEN_RELAY },
  { urls: 'turn:openrelay.metered.ca:443', ...OPEN_RELAY },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', ...OPEN_RELAY },
  // TLS on 443. The last resort that a captive or corporate network cannot tell
  // from an ordinary HTTPS connection, and so the one entry most likely to work
  // where every other candidate has been dropped.
  { urls: 'turns:openrelay.metered.ca:443', ...OPEN_RELAY },
  // PeerJS's own free relay, kept as a final fallback: it is 3478-only, so it
  // helps exactly where the network was never the problem.
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
]

/**
 * Broker options for `new Peer()`. Empty by default, which leaves PeerJS on its
 * public cloud broker — the free tier rate-limits per IP, and every player behind
 * one hotspot shares an IP, so a table that outgrows it wants its own PeerServer.
 * That should be an environment variable, not a patch.
 */
export interface BrokerOptions {
  host?: string
  port?: number
  path?: string
  key?: string
  secure?: boolean
}

/**
 * Parses a JSON override. Anything unparseable falls back to the built-in value:
 * a mistyped environment variable must cost a warning in the console, never a
 * session at the table.
 */
function parseJsonEnv<T>(name: string, raw: string | undefined, valid: (value: unknown) => value is T): T | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!valid(parsed)) {
      console.warn(`${name} is not in the expected shape — using the built-in default.`)
      return null
    }
    return parsed
  } catch {
    console.warn(`${name} is not valid JSON — using the built-in default.`)
    return null
  }
}

function isIceServerList(value: unknown): value is RTCIceServer[] {
  // One malformed entry makes the whole list suspect, and gathering against a
  // half-valid list fails in ways that look like a network fault. Reject it all.
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'object' && entry !== null && 'urls' in entry)
  )
}

function isBrokerOptions(value: unknown): value is BrokerOptions {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function iceServers(): RTCIceServer[] {
  return parseJsonEnv('VITE_ICE_SERVERS', import.meta.env.VITE_ICE_SERVERS, isIceServerList) ?? DEFAULT_ICE_SERVERS
}

export function brokerOptions(): BrokerOptions {
  return parseJsonEnv('VITE_PEER_SERVER', import.meta.env.VITE_PEER_SERVER, isBrokerOptions) ?? {}
}

/**
 * Which candidates an attempt is allowed to use. Attempts alternate between the
 * two rather than settling on one: `relay` fails outright when no relay
 * allocation succeeds, while `all` can settle on a candidate pair that only
 * half-works — so a table where either is broken still gets a working attempt
 * every second try.
 */
export function policyForAttempt(attempt: number): RTCIceTransportPolicy {
  return attempt % 2 === 1 ? 'relay' : 'all'
}

/** Options to hand `new Peer()`, for a given attempt's transport policy. */
export function peerOptions(policy: RTCIceTransportPolicy = 'all') {
  const config: PeerRtcConfig = {
    iceServers: iceServers(),
    iceTransportPolicy: policy,
    sdpSemantics: 'unified-plan',
  }
  return { ...brokerOptions(), config }
}
