import { mdiMonitor, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useEffect, useState } from 'react'
import './app.css'
import { Icon } from './components/Icon'
import { BackupReminder } from './components/BackupReminder'
import { BattleControls } from './components/BattleControls'
import { HostControls, useLocalPlayerViewHost } from './features/playerView/HostControls'
import { StatblockPanel } from './components/StatblockPanel'
import { TrackerPane } from './components/TrackerPane'
import { battleStore, useBattleState } from './store/battleStore'

type Theme = 'dark' | 'light'

const THEME_KEY = '5ect-theme'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [showPlayerView, setShowPlayerView] = useState(false)
  const [theme, toggleTheme] = useTheme()
  // AoE multi-select lives here so the statblock's "apply condition" dialog
  // can pre-select the checked combatants
  const [multiSelect, setMultiSelect] = useState(false)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
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
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
        >
          <Icon path={theme === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
        </button>
        <button
          type="button"
          className="ghost"
          aria-label="Player View"
          title="Player View"
          onClick={() => setShowPlayerView(true)}
        >
          <Icon path={mdiMonitor} />
        </button>
        <BattleControls />
      </header>
      {showPlayerView && <HostControls onClose={() => setShowPlayerView(false)} />}
      <BackupReminder />
      <div className="panes">
        <TrackerPane
          selectedId={shown?.id ?? null}
          onSelect={setSelectedId}
          multiSelect={multiSelect}
          onMultiSelectChange={(on) => {
            setMultiSelect(on)
            setChecked(new Set())
          }}
          checked={checked}
          onCheckedChange={setChecked}
        />
        <aside className="statblock-pane">
          {shown ? (
            <StatblockPanel
              combatant={shown}
              pinned={pinnedId === shown.id}
              onTogglePin={() => setPinnedId(pinnedId === shown.id ? null : shown.id)}
              preselectIds={multiSelect ? checked : undefined}
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
