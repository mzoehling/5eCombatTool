import { mdiBookOpenVariant, mdiCog, mdiMonitor, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { useEffect, useState } from 'react'
import './app.css'
import { Icon } from './components/Icon'
import { BackupReminder } from './components/BackupReminder'
import { HistoryButtons } from './components/BattleControls'
import { Compendium } from './components/Compendium'
import { ContentManager } from './components/ContentManager'
import { EncountersManager } from './components/EncountersManager'
import { GroupsEditor } from './components/GroupsEditor'
import { HostControls, useLocalPlayerViewHost } from './features/playerView/HostControls'
import { SettingsInfo } from './components/SettingsInfo'
import { StatblockPanel } from './components/StatblockPanel'
import { TrackerPane } from './components/TrackerPane'
import { UpdateBanner } from './components/UpdateBanner'
import { battleStore, useBattleState } from './store/battleStore'

type Theme = 'dark' | 'light'

const THEME_KEY = '5ect-theme'

function useTheme(): [Theme, () => void] {
  // Light (warm vellum) is the default; only an explicitly stored 'dark' opts out.
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'))
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
  const [showSettings, setShowSettings] = useState(false)
  // The library dialogs are opened from the top bar, so their state lives here
  // rather than in the tracker pane.
  const [libraryModal, setLibraryModal] = useState<'compendium' | 'encounters' | 'groups' | 'content' | null>(null)
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

  // Ctrl/Cmd+Z undoes the last battle change — except while typing in a field
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return
      e.preventDefault()
      battleStore.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
      {/* Navigation, then history, then the view controls. Turn control is not
          here — it lives in the dock below the tracker list, where it cannot
          drift out of reach as the list scrolls. */}
      <header className="topbar">
        <h1 className="app-title">5e Combat Tool</h1>
        <button type="button" className="primary icon-label" onClick={() => setLibraryModal('compendium')}>
          <Icon path={mdiBookOpenVariant} /> Compendium
        </button>
        <button type="button" onClick={() => setLibraryModal('encounters')}>
          Encounters
        </button>
        <button type="button" onClick={() => setLibraryModal('groups')}>
          Groups
        </button>
        <button type="button" onClick={() => setLibraryModal('content')}>
          Content
        </button>
        <span className="topbar-divider" />
        <HistoryButtons />
        <span className="topbar-spacer" />
        <button
          type="button"
          className="ghost icon-only"
          aria-label="Player View"
          title="Player View"
          onClick={() => setShowPlayerView(true)}
        >
          <Icon path={mdiMonitor} />
        </button>
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
      </header>
      {showPlayerView && <HostControls onClose={() => setShowPlayerView(false)} />}
      {showSettings && <SettingsInfo onClose={() => setShowSettings(false)} />}
      {libraryModal === 'compendium' && <Compendium onClose={() => setLibraryModal(null)} />}
      {libraryModal === 'encounters' && <EncountersManager onClose={() => setLibraryModal(null)} />}
      {libraryModal === 'groups' && <GroupsEditor onClose={() => setLibraryModal(null)} />}
      {libraryModal === 'content' && <ContentManager onClose={() => setLibraryModal(null)} />}
      <UpdateBanner />
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
