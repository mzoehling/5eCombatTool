import { useState } from 'react'
import './viewer.css'
import { isJoinCode } from './transport'

/**
 * The screen the DM's dialog has always promised.
 *
 * "Players open the app and enter this code" was true of everything except the
 * app, which only ever read a code out of the URL — so a player who could not
 * scan the QR had to be read a long link across the table, character by
 * character, hash fragment and all.
 */
export function JoinScreen() {
  const [code, setCode] = useState('')
  const entered = code.trim().toUpperCase()
  const ready = isJoinCode(entered)

  return (
    <div className="pv-app pv-join">
      <header className="pv-header">
        <span className="pv-round">—</span>
        <h1>Join a table</h1>
      </header>
      <form
        className="pv-join-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) location.hash = `#/play/${entered}`
        }}
      >
        <label htmlFor="pv-join-code">Enter the code your DM is showing</label>
        <input
          id="pv-join-code"
          className="pv-join-input num"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // Six characters of one fixed alphabet: no autocorrect to fight, no
          // capitalisation to guess, and nothing worth remembering for next time.
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={6}
          placeholder="ABC234"
          aria-describedby="pv-join-hint"
        />
        <p id="pv-join-hint" className="dim">
          Six characters. The letters O, I and L never appear, and neither do the digits 0 and 1 — so a character that
          looks like one of those is the other.
        </p>
        <button type="submit" className="primary" disabled={!ready}>
          Join
        </button>
      </form>
    </div>
  )
}
