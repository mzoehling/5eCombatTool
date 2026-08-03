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
import { Drawer, useDrawer } from './components/Drawer'
import { EncountersManager } from './components/EncountersManager'
import { HostControls, useLocalPlayerViewHost } from './features/playerView/HostControls'
import { SettingsInfo } from './components/SettingsInfo'
import { StatblockPanel } from './components/StatblockPanel'
import { TrackerPane } from './components/TrackerPane'
import { UpdateBanner } from './components/UpdateBanner'
import { rollDie } from './lib/dice'
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

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [showPlayerView, setShowPlayerView] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // The library dialogs are opened from the top bar, so their state lives here
  // rather than in the tracker pane. Content is a tab of Encounters now, not a
  // dialog of its own.
  const [libraryModal, setLibraryModal] = useState<'compendium' | 'encounters' | null>(null)
  /**
   * Selection, pin and the AoE bar. One reducer rather than five `useState`
   * calls: two gestures move more than one of them at once — a roll arms the bar
   * *and* fills the amount, a turn change releases the selection — and as
   * separate setState calls those had to be kept in step by hand.
   *
   * The AoE bar's state belongs at this level rather than in the tracker pane
   * because the dice roller writes into it, and the roller opens from the
   * statblock's dice links as well as from the dock.
   *
   * View state only: see store/trackerUi.ts. It never touches the battle
   * reducer, which stays the single write path for anything persisted or
   * broadcast.
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

  if (!hydrated) {
    return (
      <main className="loading">
        <p>Loading…</p>
      </main>
    )
  }

  const shownId = ui.pinnedId ?? ui.selectedId ?? (state.battle.isRunning ? activeId : null)
  const shown = state.combatants.find((c) => c.id === shownId)

  return (
    <div className="app">
      {/* Three zones: navigation and history on the left, the round in the
          middle, the view controls on the right. The round sits here rather than
          in the dock — the top bar cannot scroll either, and this leaves the
          dock to the tools. */}
      <header className="topbar">
        <div className="topbar-group">
          <h1 className="app-title">5e Combat Tool</h1>
          <button type="button" className="primary icon-label" onClick={() => setLibraryModal('compendium')}>
            <Icon path={mdiBookOpenVariant} /> Compendium
          </button>
          <button type="button" onClick={() => setLibraryModal('encounters')}>
            Encounters
          </button>
          <HistoryButton />
        </div>
        <TurnControls />
        <div className="topbar-group end">
          <button
            type="button"
            className="ghost icon-only"
            aria-label="Statblock"
            title="Statblock"
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
      {libraryModal === 'compendium' && <Compendium onClose={() => setLibraryModal(null)} />}
      {libraryModal === 'encounters' && <EncountersManager onClose={() => setLibraryModal(null)} />}
      <UpdateBanner />
      <BackupReminder />
      <div className={`panes drawer-host drawer-side-${drawer.side}`} ref={setShell}>
        <TrackerPane
          selectedId={shown?.id ?? null}
          onSelect={(id) => {
            uiDispatch({ type: 'select', id })
            // Looking something up is what the drawer is for, so selecting a
            // combatant opens it. It starts closed, and this is the gesture that
            // opens it without a second tap.
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
        <Drawer state={drawer} title="Statblock">
          {shown ? (
            <StatblockPanel
              combatant={shown}
              pinned={ui.pinnedId === shown.id}
              onTogglePin={() => uiDispatch({ type: 'togglePin', id: shown.id })}
              onSendRollToAoe={sendRollToAoe}
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
