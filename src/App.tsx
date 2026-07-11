import { useEffect, useState } from 'react'
import './app.css'
import { BackupReminder } from './components/BackupReminder'
import { BattleControls } from './components/BattleControls'
import { HostControls, useLocalPlayerViewHost } from './features/playerView/HostControls'
import { StatblockPanel } from './components/StatblockPanel'
import { TrackerPane } from './components/TrackerPane'
import { battleStore, useBattleState } from './store/battleStore'

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [showPlayerView, setShowPlayerView] = useState(false)
  const state = useBattleState()
  const activeId = state.battle.activeCombatantId
  useLocalPlayerViewHost()

  useEffect(() => {
    battleStore
      .hydrate()
      .catch((err: unknown) => console.error('hydrate failed:', err))
      .finally(() => setHydrated(true))
  }, [])

  // unpinned panel follows the turn: a turn change resets manual selection
  useEffect(() => setSelectedId(null), [activeId])

  if (!hydrated) {
    return (
      <main className="loading">
        <p>Loading…</p>
      </main>
    )
  }

  const shownId = pinnedId ?? selectedId ?? (state.battle.isRunning ? activeId : null)
  const shown = state.combatants.find((c) => c.id === shownId)

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="app-title">5e Combat Tool</h1>
        <button
          type="button"
          className="ghost"
          aria-label="Player View"
          title="Player View"
          onClick={() => setShowPlayerView(true)}
        >
          📺
        </button>
        <BattleControls />
      </header>
      {showPlayerView && <HostControls onClose={() => setShowPlayerView(false)} />}
      <BackupReminder />
      <div className="panes">
        <TrackerPane selectedId={shown?.id ?? null} onSelect={setSelectedId} />
        <aside className="statblock-pane">
          {shown ? (
            <StatblockPanel
              combatant={shown}
              pinned={pinnedId === shown.id}
              onTogglePin={() => setPinnedId(pinnedId === shown.id ? null : shown.id)}
            />
          ) : (
            <p className="dim empty-hint">Select a combatant to see its statblock.</p>
          )}
        </aside>
      </div>
      <footer className="app-footer">
        Includes material from the System Reference Document 5.2.1 by Wizards of the Coast LLC, licensed under
        CC-BY-4.0.
      </footer>
    </div>
  )
}

export default App
