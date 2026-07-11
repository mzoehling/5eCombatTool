import { useEffect, useState } from 'react'
import './app.css'
import { BattleControls } from './components/BattleControls'
import { TrackerPane } from './components/TrackerPane'
import { battleStore, useBattleState } from './store/battleStore'

function App() {
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const state = useBattleState()

  useEffect(() => {
    battleStore
      .hydrate()
      .catch((err: unknown) => console.error('hydrate failed:', err))
      .finally(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <main className="loading">
        <p>Loading…</p>
      </main>
    )
  }

  const selected = state.combatants.find((c) => c.id === selectedId)

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="app-title">5e Combat Tool</h1>
        <BattleControls />
      </header>
      <div className="panes">
        <TrackerPane selectedId={selectedId} onSelect={setSelectedId} />
        <aside className="statblock-pane">
          {selected ? (
            <div className="statblock-placeholder">
              <h2>{selected.name}</h2>
              <p className="dim">Statblock panel arrives in the next build step.</p>
            </div>
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
