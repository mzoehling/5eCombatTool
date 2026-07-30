import { mdiDiceMultiple, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useCallback, useEffect, useRef, useState } from 'react'
import './viewer.css'
import { DiceRoller } from '../../components/DiceRoller'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { describeCondition } from '../../data/conditionInfo'
import { nameRuns } from '../../lib/groups'
import { hpMeterWidths } from '../../lib/hpMeter'
import { upNext } from '../../lib/turnOrder'
import { useTheme } from '../../lib/useTheme'
import type { PlayerParticipant, PlayerSnapshot } from './projection'
import {
  connectBroadcastViewer,
  connectPeerViewer,
  LOCAL_CODE,
  type ViewerStatus,
  type ViewerTransport,
} from './transport'

/**
 * One line for a bundle: how many are still standing, in the same vocabulary a
 * single monster uses. It never adds up hit points — monster HP is a status
 * word to the players, and a pooled total would be a number they should not
 * have.
 */
function bundleStatus(members: PlayerParticipant[]): string {
  const down = members.filter((p) => (p.health.kind === 'npc' ? p.health.status === 'Down' : p.health.hp <= 0)).length
  if (down === 0) return `${members.length} up`
  if (down === members.length) return 'all down'
  return `${members.length - down} up, ${down} down`
}

/** Monster HP stays a status word; only PCs show numbers. */
function Health({ participant }: { participant: PlayerParticipant }) {
  const h = participant.health
  if (h.kind === 'pc') {
    return (
      <span className="pv-health pc num">
        {h.hp}/{h.maxHp}
        {h.tempHp > 0 && <span className="pv-temp"> +{h.tempHp}</span>}
      </span>
    )
  }
  return <span className={`pv-health status-${h.status.toLowerCase()}`}>{h.status}</span>
}

function Conditions({
  participant,
  onOpen,
}: {
  participant: PlayerParticipant
  onOpen: (condition: string) => void
}) {
  if (participant.conditions.length === 0) return null
  return (
    <span className="pv-conditions">
      {participant.conditions.map((c) => (
        <button
          key={c.condition}
          type="button"
          className="pv-chip"
          title={`What does ${c.condition} do?`}
          onClick={() => onOpen(c.condition)}
        >
          {c.condition === 'Exhaustion' ? `Exhaustion ${c.level ?? 1}` : c.condition}
          {c.remainingRounds != null && ` (${c.remainingRounds})`}
        </button>
      ))}
    </span>
  )
}

/** Temp HP extends the bar's scale, so 20 temp on 90/100 reads as 20. */
function SpotlightMeter({ hp, maxHp, tempHp }: { hp: number; maxHp: number; tempHp: number }) {
  const w = hpMeterWidths(hp, maxHp, tempHp)
  return (
    <span className="hp-meter pv-spotlight-meter">
      <span className="hp-meter-fill" style={{ width: `${w.hp}%` }} />
      {w.temp > 0 && <span className="hp-meter-temp" style={{ left: `${w.hp}%`, width: `${w.temp}%` }} />}
    </span>
  )
}

/** The creature acting right now, given the whole width it deserves. */
function Spotlight({
  participant,
  onCondition,
}: {
  participant: PlayerParticipant
  onCondition: (condition: string) => void
}) {
  return (
    <section className="pv-spotlight">
      <p className="pv-spotlight-label">Acting now</p>
      <div className="pv-spotlight-head">
        <h2 className="pv-spotlight-name">{participant.name}</h2>
        <span className={`badge ${participant.isPC ? 'pc' : 'group'}`}>{participant.isPC ? 'PC' : 'Monster'}</span>
      </div>
      <div className="pv-spotlight-stats">
        <Health participant={participant} />
      </div>
      {participant.health.kind === 'pc' && (
        <SpotlightMeter hp={participant.health.hp} maxHp={participant.health.maxHp} tempHp={participant.health.tempHp} />
      )}
      <Conditions participant={participant} onOpen={onCondition} />
    </section>
  )
}

/**
 * A phone at a table loses signal constantly. Each state keeps the round header
 * above it so nothing looks crashed, and reconnecting keeps the last state on
 * screen — stale information still beats a blank page.
 */
function ConnectionState({
  status,
  code,
  snapshot,
  activeName,
  onRetry,
}: {
  status: ViewerStatus
  code: string
  snapshot: PlayerSnapshot | null
  activeName: string | null
  onRetry: () => void
}) {
  if (status === 'connected') return null

  if (status === 'connecting') {
    return (
      <div className="pv-state accent" role="status">
        <p>
          Joining the table with code <span className="num">{code.toUpperCase()}</span>…
        </p>
      </div>
    )
  }

  if (status === 'ended') {
    return (
      <div className="pv-state dim-state" role="status">
        <p>Your DM closed the Player View.</p>
        <button type="button" onClick={() => window.close()}>
          Leave
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="pv-state warn" role="status">
        <p>Lost the connection — trying again automatically.</p>
        {/* Never ask the player to re-enter the code: the app already has it. */}
        <button type="button" onClick={onRetry}>
          Retry now
        </button>
      </div>
      {snapshot && (
        <p className="pv-stale">
          Showing the last state received · Round <span className="num">{snapshot.round}</span>
          {activeName && ` · ${activeName} acting`}
        </p>
      )}
    </>
  )
}

export function ViewerApp({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null)
  const [status, setStatus] = useState<ViewerStatus>('connecting')
  const [showDice, setShowDice] = useState(false)
  const [conditionInfo, setConditionInfo] = useState<string | null>(null)
  const [theme, toggleTheme] = useTheme()
  const transportRef = useRef<ViewerTransport | null>(null)
  // stable identity: an arriving snapshot must not re-render the open roller
  // and clobber the expression the player is halfway through typing
  const closeDice = useCallback(() => setShowDice(false), [])
  const retry = useCallback(() => transportRef.current?.retryNow(), [])

  useEffect(() => {
    const handlers = { onSnapshot: setSnapshot, onStatus: setStatus }
    const transport =
      code.toLowerCase() === LOCAL_CODE ? connectBroadcastViewer(handlers) : connectPeerViewer(code, handlers)
    transportRef.current = transport
    return () => {
      transportRef.current = null
      transport.close()
    }
  }, [code])

  const participants = snapshot?.participants ?? []
  const activeIndex = snapshot ? participants.findIndex((p) => p.id === snapshot.activeId) : -1
  const active = activeIndex >= 0 ? participants[activeIndex] : null
  // Only what is still to come this round. The spotlight already carries
  // whoever is acting and the rail above carries everyone, so the list answers
  // the one question it is uniquely placed to answer: how many more turns until
  // the round comes back around. Listing the creatures that have already gone
  // would bury that count.
  const remaining = upNext(participants, snapshot?.activeId ?? null)

  return (
    <div className="pv-app">
      <header className="pv-header">
        <span className="pv-round">
          {snapshot?.isRunning ? `Round ${snapshot.round}` : snapshot ? 'Forming up…' : '—'}
        </span>
        <h1>Battle</h1>
        {/* A phone at a dark table wants the candlelit palette as much as the
            DM's iPad does, and the viewer is its own root — it cannot inherit
            the DM's choice. */}
        <button
          type="button"
          className="pv-dice-btn"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          <Icon path={theme === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
        </button>
        <button type="button" className="pv-dice-btn" aria-label="Dice Roller" onClick={() => setShowDice(true)}>
          <Icon path={mdiDiceMultiple} />
        </button>
      </header>

      {showDice && <DiceRoller onClose={closeDice} />}
      {conditionInfo && (
        <Modal title={conditionInfo} onClose={() => setConditionInfo(null)}>
          <p>{describeCondition(conditionInfo) ?? 'A custom effect — ask your DM what it does.'}</p>
        </Modal>
      )}

      <ConnectionState
        status={status}
        code={code}
        snapshot={snapshot}
        activeName={active?.name ?? null}
        onRetry={retry}
      />

      <div className="pv-body">
        <div className="pv-primary">
          {/* Turn rail: circular initiative tokens, the active one enlarged. */}
          {snapshot && snapshot.participants.length > 0 && (
            <ol className="pv-rail">
              {snapshot.participants.map((p) => (
                <li key={p.id} className={p.id === snapshot.activeId ? 'active' : ''}>
                  <span className="pv-token" title={p.name}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {active && <Spotlight participant={active} onCondition={setConditionInfo} />}
          <button type="button" className="pv-roll-wide" onClick={() => setShowDice(true)}>
            <Icon path={mdiDiceMultiple} /> Roll dice
          </button>
        </div>

        {/* Bundled by shared base name, not by the DM's groups: those are named
            after encounters ("Goblin Ambush", "Boss Phase 2") and sending them
            would hand the table the DM's prep. A base name is already on
            screen. There is no expander either — a player taps exactly two
            things, a condition chip and the dice button — so a bundle of one
            kind of creature simply reads as one line. */}
        <div className="pv-upnext">
          <p className="pv-upnext-head">
            {activeIndex < 0 ? (
              'Turn order'
            ) : remaining.length === 0 ? (
              'Last turn of the round'
            ) : (
              <>
                Up next · <span className="num">{remaining.length}</span> until the round ends
              </>
            )}
          </p>
          <ol className="pv-list">
          {nameRuns(remaining).map((run, i) =>
            run.members.length > 1 ? (
              <li key={`${run.label}-${i}`} className="pv-bundle">
                <span className="pv-name">
                  <span className="pv-name-row">
                    <span className="pv-name-text">{run.label}</span>
                    <span className="badge group">×{run.members.length}</span>
                  </span>
                </span>
                <span className="pv-health dim">{bundleStatus(run.members)}</span>
              </li>
            ) : (
              run.members.map((p) => (
                <li key={p.id}>
                  <span className="pv-name">
                    <span className="pv-name-row">
                      <span className="pv-name-text">{p.name}</span>
                      {p.isPC && <span className="badge pc">PC</span>}
                    </span>
                    <Conditions participant={p} onOpen={setConditionInfo} />
                  </span>
                  <Health participant={p} />
                </li>
              ))
            ),
          )}
          {snapshot && participants.length === 0 && <li className="pv-empty">Waiting for combatants…</li>}
          {snapshot && participants.length > 0 && remaining.length === 0 && (
            <li className="pv-empty">Everyone else has acted — the round ends here.</li>
          )}
          </ol>
        </div>
      </div>
    </div>
  )
}
