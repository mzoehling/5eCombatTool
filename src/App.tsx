import {
  mdiBookOpenVariant,
  mdiCog,
  mdiFileDocumentOutline,
  mdiMonitor,
  mdiWeatherNight,
  mdiWeatherSunny,
} from '@mdi/js'
import { useEffect, useState } from 'react'
import './app.css'
import { Icon } from './components/Icon'
import { BackupReminder } from './components/BackupReminder'
import { HistoryButton, TurnControls } from './components/BattleControls'
import { Compendium } from './components/Compendium'
import { ConditionInfo } from './components/ConditionInfo'
import { CreatureInfo } from './components/CreatureInfo'
import { DiceRoller } from './components/DiceRoller'
import { Drawer, useDrawer } from './components/Drawer'
import { ItemInfo } from './components/ItemInfo'
import { RuleInfo } from './components/RuleInfo'
import { SpellInfo } from './components/SpellInfo'
import { EncountersManager } from './components/EncountersManager'
import { HostControls, useLocalPlayerViewHost } from './features/playerView/HostControls'
import { SettingsInfo } from './components/SettingsInfo'
import { StatblockPanel } from './components/StatblockPanel'
import { TrackerPane } from './components/TrackerPane'
import { UpdateBanner } from './components/UpdateBanner'
import { rollDie } from './lib/dice'
import { referenceTitle, type ReferenceView } from './lib/referenceStack'
import { useTheme } from './lib/useTheme'
import { battleStore, useBattleState } from './store/battleStore'
import { useTrackerUi } from './store/trackerUi'

/** Pre-rolled d6 pool for the reducer's recharge checks (it stays pure). */
const rechargeDice = () => Array.from({ length: 8 }, () => rollDie(6))

/** Focus is in a field, so the keystroke belongs to the field. */
function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  return el instanceof HTMLElement && el.isContentEditable
}

/**
 * Whether Space belongs to whatever is focused rather than to the turn.
 *
 * In a browser Space activates the focused button, so an unguarded Space handler
 * fires that button *and* advances the turn — every tap on a control would cost
 * a turn. Reading `document.activeElement` instead of `e.target` is what catches
 * it: after a tap the button keeps focus while the event targets the document.
 */
function spaceIsClaimed(): boolean {
  const el = document.activeElement
  if (!el || el === document.body) return isTyping()
  if (isTyping()) return true
  return el.matches('button, a, [role="button"], [tabindex]:not([tabindex="-1"])')
}

/**
 * Renders whichever reference view is on top of the drawer's stack.
 *
 * Each of these used to bring its own `Modal` and stack over whatever opened it.
 * They are bodies now: the drawer owns the shell, the title and the way back.
 */
function ReferenceViewBody({
  view,
  onOpenReference,
  onSendRollToAoe,
}: {
  view: ReferenceView
  onOpenReference: (view: ReferenceView) => void
  onSendRollToAoe: (amount: number) => void
}) {
  // Dice stay a dialog over the drawer rather than a level on its stack: rolling
  // is an action, and the stack is for reading. One roller for all the sheets,
  // held here so each sheet does not need its own.
  const [rollExpr, setRollExpr] = useState<string | null>(null)
  const links = {
    onDice: setRollExpr,
    onCondition: (name: string) => onOpenReference({ kind: 'condition', name }),
    onSpell: (name: string) => onOpenReference({ kind: 'spell', name }),
    onItem: (name: string) => onOpenReference({ kind: 'item', name }),
    onCreature: (name: string) => onOpenReference({ kind: 'creature', name }),
    onRule: (name: string) => onOpenReference({ kind: 'rule', name }),
  }

  const body = (() => {
    switch (view.kind) {
      case 'compendium':
        // Rendered by App instead, so it survives being covered — see there.
        return null
      case 'spell':
        return <SpellInfo name={view.name} {...links} />
      case 'item':
        return <ItemInfo name={view.name} {...links} />
      case 'rule':
        return <RuleInfo name={view.name} {...links} />
      case 'creature':
        return (
          <CreatureInfo name={view.name} onSendRollToAoe={onSendRollToAoe} onOpenReference={onOpenReference} />
        )
      case 'condition':
        return <ConditionInfo name={view.name} />
    }
  })()

  return (
    <>
      {body}
      {rollExpr !== null && (
        <DiceRoller initialExpression={rollExpr} onSendToAoe={onSendRollToAoe} onClose={() => setRollExpr(null)} />
      )}
    </>
  )
}

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [showPlayerView, setShowPlayerView] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showEncounters, setShowEncounters] = useState(false)
  /**
   * Selection, pin, the AoE bar and the drawer's reference stack. One reducer
   * rather than six `useState` calls: several gestures move more than one of
   * them at once (a roll arms the bar *and* fills the amount; a turn change
   * releases the selection), and as separate setState calls those had to be kept
   * in step by hand. See store/trackerUi.ts — it is view state only and never
   * touches the battle reducer, which stays the single write path.
   */
  const [ui, uiDispatch] = useTrackerUi()
  const [theme, toggleTheme] = useTheme()
  const state = useBattleState()
  const activeId = state.battle.activeCombatantId
  useLocalPlayerViewHost()

  // The drawer and the tracker share this box: its size is the extent the
  // drawer's limits are derived from. Held as state rather than a ref because it
  // does not exist until after hydration — see `useDrawer`.
  const [shell, setShell] = useState<HTMLDivElement | null>(null)
  const drawer = useDrawer(shell)

  useEffect(() => {
    battleStore
      .hydrate()
      .catch((err: unknown) => console.error('hydrate failed:', err))
      .finally(() => setHydrated(true))
  }, [])

  // Keyboard shortcuts: Ctrl/Cmd+Z undoes, Space advances the turn. Both are
  // window-level and both skip anything focused that would consume the key.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        // A focused button does not consume Ctrl+Z, so only fields are excluded.
        if (isTyping()) return
        e.preventDefault()
        battleStore.undo()
        return
      }
      if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (spaceIsClaimed()) return
        if (!battleStore.getState().battle.isRunning) return
        e.preventDefault()
        battleStore.dispatch({ type: 'nextTurn', dice: rechargeDice() })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // unpinned panel follows the turn: a turn change releases manual selection
  useEffect(() => uiDispatch({ type: 'turnChanged' }), [activeId, uiDispatch])

  /** A rolled total goes into the AoE bar, which is the one place that applies
   *  damage to a selection. Arming the bar is part of it — otherwise the number
   *  would land somewhere the DM cannot see. */
  const sendRollToAoe = (amount: number) => uiDispatch({ type: 'sendRollToAoe', amount })

  /** Follows a reference into the drawer, opening the drawer if it was shut. */
  const openReference = (view: ReferenceView) => {
    uiDispatch({ type: 'pushReference', view })
    drawer.open()
  }

  if (!hydrated) {
    return (
      <main className="loading">
        <p>Loading…</p>
      </main>
    )
  }

  const shownId = ui.pinnedId ?? ui.selectedId ?? (state.battle.isRunning ? activeId : null)
  const shown = state.combatants.find((c) => c.id === shownId)
  // The floor of the drawer is the statblock of whoever is selected or acting;
  // the stack holds only what was pushed on top of it.
  const view = ui.reference.at(-1)
  // The compendium stays mounted for as long as it is anywhere in the stack, and
  // is merely hidden while something sits on top of it. Unmounting it threw away
  // the query, the tab, the filters and the scroll position, so coming back out
  // of a spell landed on an empty search — the opposite of what a stack is for.
  // The reference sheets are stateless lookups and need no such treatment.
  const compendiumInStack = ui.reference.some((v) => v.kind === 'compendium')

  return (
    <div className="app">
      {/* Three zones: navigation and history on the left, the round in the
          middle, the view controls on the right. The round sits here rather than
          in the dock — the top bar cannot scroll either, and this leaves the
          dock to the tools. */}
      <header className="topbar">
        <div className="topbar-group">
          <h1 className="app-title">5e Combat Tool</h1>
          {/* The compendium is a drawer view, not a dialog: it is something to
              look up, and it is where creatures are added to the tracker from,
              which wants the tracker visible beside it. */}
          <button
            type="button"
            className="primary icon-label"
            onClick={() => openReference({ kind: 'compendium' })}
          >
            <Icon path={mdiBookOpenVariant} /> Compendium
          </button>
          <button type="button" onClick={() => setShowEncounters(true)}>
            Encounters
          </button>
          <HistoryButton />
        </div>
        <TurnControls />
        <div className="topbar-group end">
          <button
            type="button"
            className="ghost icon-only"
            aria-label="Reference drawer"
            title="Reference drawer"
            aria-pressed={drawer.mode !== 'closed'}
            onClick={drawer.toggle}
          >
            <Icon path={mdiFileDocumentOutline} />
          </button>
          <button
            type="button"
            className="ghost icon-only"
            aria-label="Player View"
            title="Player View"
            onClick={() => setShowPlayerView(true)}
          >
            <Icon path={mdiMonitor} />
          </button>
          {/* Stays in the bar rather than moving into Settings: the room light
              changes over an evening at the table, which makes this a frequent
              one-tap action, not a setting. */}
          <button
            type="button"
            className="ghost icon-only"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleTheme}
          >
            <Icon path={theme === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
          </button>
          <button
            type="button"
            className="ghost icon-only"
            aria-label="Settings"
            title="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Icon path={mdiCog} />
          </button>
        </div>
      </header>
      {showPlayerView && <HostControls onClose={() => setShowPlayerView(false)} />}
      {showSettings && <SettingsInfo onClose={() => setShowSettings(false)} />}
      {showEncounters && <EncountersManager onClose={() => setShowEncounters(false)} />}
      <UpdateBanner />
      <BackupReminder />
      <div className={`panes drawer-host drawer-side-${drawer.side}`} ref={setShell}>
        <TrackerPane
          selectedId={shown?.id ?? null}
          onSelect={(id) => {
            uiDispatch({ type: 'select', id })
            // Selecting a combatant means "show me this", so it returns the
            // drawer to the floor and opens it if it was shut.
            uiDispatch({ type: 'clearReference' })
            drawer.open()
          }}
          multiSelect={ui.multiSelect}
          onMultiSelectChange={(on) => uiDispatch({ type: 'setMultiSelect', on })}
          checked={ui.checked}
          onCheckedChange={(checked) => uiDispatch({ type: 'setChecked', checked })}
          aoeAmount={ui.aoeAmount}
          onAoeAmountChange={(amount) => uiDispatch({ type: 'setAoeAmount', amount })}
          onSendRollToAoe={sendRollToAoe}
        />
        {/* One surface for everything the DM looks up, as a stack: the selected
            combatant's statblock is the floor, and every reference followed out
            of any text pushes a level on top of it with a `‹` back out. */}
        <Drawer
          state={drawer}
          title={view ? referenceTitle(view) : 'Statblock'}
          onBack={view ? () => uiDispatch({ type: 'popReference' }) : undefined}
          split={view?.kind === 'compendium'}
        >
          {compendiumInStack && (
            <div className="drawer-view" hidden={view?.kind !== 'compendium'}>
              <Compendium onOpenReference={openReference} onSendRollToAoe={sendRollToAoe} />
            </div>
          )}
          {view && view.kind !== 'compendium' ? (
            <ReferenceViewBody view={view} onOpenReference={openReference} onSendRollToAoe={sendRollToAoe} />
          ) : view ? null : shown ? (
            <StatblockPanel
              combatant={shown}
              pinned={ui.pinnedId === shown.id}
              onTogglePin={() => uiDispatch({ type: 'togglePin', id: shown.id })}
              onSendRollToAoe={sendRollToAoe}
              onOpenReference={openReference}
            />
          ) : (
            <p className="dim empty-hint">Select a combatant to see its statblock.</p>
          )}
        </Drawer>
      </div>
      <footer className="app-footer">
        Includes material from the System Reference Document 5.2.1 by Wizards of the Coast LLC, licensed under
        CC-BY-4.0.
      </footer>
    </div>
  )
}

export default App
