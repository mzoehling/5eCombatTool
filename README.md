# 5e Combat Tool

An offline-first initiative & battle tracker PWA for D&D 5e (2024), built for running sessions on an iPad at the table.

**Live app:** https://mzoehling.github.io/5eCombatTool/

Install to the home screen on iPadOS: open the URL in Safari → Share → **Add to Home Screen**. The app works fully offline from first launch.

## Features

- Initiative tracker: one-line rows, sorted by initiative, drag-reorder for genuine ties, per-creature rolls, groups that collapse into a single row. Health is the row's own background fill — temp HP extends it as a tinted slice rather than being clipped inside the maximum
- Turn control in the top bar, where it cannot scroll out of reach: `‹ Round 3 ›`, or Space for the next turn
- HP / AC tracking: temp HP absorbs first, arithmetic input ("10+3"), AC as a shield glyph, multi-select AoE damage/heal — with a save helper that rolls one d20 per target against its own bonus and takes full or half accordingly
- Conditions: full 2024 condition set + concentration + exhaustion, with optional round durations that tick down automatically; turn-start automation surfaces expiry and concentration-break prompts. Tap a condition in any rules text to read what it does, then apply it from the same sheet
- Statblocks in the 2024 layout with limited-use tracking (X/Day, recharge, legendary actions), death saves for PCs, and interactive links to referenced spells/items/creatures/rules. They live in a resizable drawer that opens from the right on a landscape iPad and from the bottom in portrait, and closes when you want the whole screen for the tracker
- Compendium: bundled SRD 5.2 content (monsters, spells, items, rules glossary) with fuzzy search and filters; item prices, derived from rarity and marked with "≈" where the source prints none; a PC tab that appears once any content pack holds player characters and lists them all, whichever pack they came from
- Encounter library (Encounters): save the current tracker as a named encounter and load or merge it back later; build a named party from your PCs; manage the groups in the running fight; end the battle or clear the tracker
- Content (a tab of Encounters): one place for the built-in Homebrew pack — custom monsters and lightweight PC entries, edited in the app — and imported content packs (JSON). Backup export/import lives in Settings
- Dice roller: a dice pad or free-form expressions, tappable to-hit/damage buttons from statblocks, ADV/DIS/CRIT — send a rolled total to the AoE bar to apply it to whichever combatants you pick
- History: what just happened, with one tap to undo the last of it, over a persistent combat log that survives reloads
- Player View: broadcast a read-only, player-safe second screen (PeerJS join code + QR, or same-device `BroadcastChannel`)

## Tech

Vite + React + TypeScript PWA, IndexedDB (Dexie) persistence, deployed to GitHub Pages via GitHub Actions on push to `main`. No backend, no accounts, no telemetry — all data stays on the device; Player View is the only feature that leaves it, and only as an opt-in, player-safe broadcast.

```bash
npm ci             # install
npm run dev        # dev server
npm test           # unit tests (Vitest) — see the note below
npm run lint       # oxlint
npm run build      # typecheck + production build
npm run build-srd  # regenerate the bundled SRD JSON from upstream source data
```

The parser is tested against real upstream source data, which is not committed
(only SRD 5.2 content may live in this repo). Those suites fail rather than skip
without it, so a fresh clone shows a couple of failures until the fixtures are
fetched — see `npm run fetch-fixtures`.

## Legal

This is a personal hobby project. It is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC.

Bundled game content is limited to the System Reference Document 5.2.1:

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Application code is licensed under the [MIT License](LICENSE).
