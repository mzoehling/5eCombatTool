# 5e Combat Tool

An offline-first initiative & battle tracker PWA for D&D 5e (2024), built for running sessions on an iPad at the table.

**Live app:** https://mzoehling.github.io/5eCombatTool/

Install to the home screen on iPadOS: open the URL in Safari → Share → **Add to Home Screen**. The app works fully offline from first launch.

## Features

- Initiative tracker: sorted list, drag-reorder for ties, per-creature rolls, groups, battle mode with round counter and active-turn highlight
- HP / AC tracking: temp HP, arithmetic input ("10+3"), HP-ratio colors, multi-select AoE damage/heal
- Conditions: full 2024 condition set + concentration + exhaustion, with optional round durations that tick down automatically; turn-start automation surfaces expiry and concentration-break prompts
- Statblocks in the 2024 layout with limited-use tracking (X/Day, recharge, legendary actions) and interactive links to referenced spells/items/creatures/rules
- Compendium: bundled SRD 5.2 content (monsters, spells, items, rules glossary) with fuzzy search and filters; import of external content packs (JSON)
- Homebrew editor for custom monsters and lightweight PC entries, with JSON backup export/import
- Encounter library: save the current tracker as a named encounter, load or merge it back in later, or clear the tracker in one step
- Dice roller: free-form expressions and tappable to-hit/damage buttons from statblocks, ADV/DIS/CRIT, apply rolled totals straight to combatants
- Undo and a persistent combat log
- Player View: broadcast a read-only, player-safe second screen (PeerJS join code + QR, or same-device `BroadcastChannel`) — see `FEATURE-PLAYER-VIEW.md`

## Tech

Vite + React + TypeScript PWA, IndexedDB (Dexie) persistence, deployed to GitHub Pages via GitHub Actions on push to `main`. No backend, no accounts, no telemetry — all data stays on the device; Player View is the only feature that leaves it, and only as an opt-in, player-safe broadcast.

```bash
npm ci             # install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # typecheck + production build
npm run build-srd  # regenerate the bundled SRD JSON from upstream source data
```

## Legal

This is a personal hobby project. It is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC.

Bundled game content is limited to the System Reference Document 5.2.1:

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Application code is licensed under the [MIT License](LICENSE).
