# 5e Combat Tool

An offline-first initiative & battle tracker PWA for D&D 5e (2024), built for running sessions on an iPad at the table.

**Live app:** https://mzoehling.github.io/5eCombatTool/

Install to the home screen on iPadOS: open the URL in Safari → Share → **Add to Home Screen**. The app works fully offline from first launch.

## Features (v1)

- Initiative tracker: sorted list, drag-reorder for ties, per-creature rolls, groups, battle mode with round counter and active-turn highlight
- HP / AC tracking: temp HP, arithmetic input ("10+3"), HP-ratio colors, multi-select AoE damage/heal
- Conditions: full 2024 condition set + concentration + exhaustion, with optional round durations that tick down automatically
- Statblocks in the 2024 layout with limited-use tracking (X/Day, recharge, legendary actions)
- Compendium: bundled SRD 5.2 content with fuzzy search and filters; import of external content packs (JSON)
- Homebrew editor for custom monsters and lightweight PC entries, with JSON backup export/import

## Tech

Vite + React + TypeScript PWA, IndexedDB (Dexie) persistence, deployed to GitHub Pages via GitHub Actions. No backend, no accounts, no telemetry — all data stays on the device.

```bash
npm ci        # install
npm run dev   # dev server
npm test      # unit tests (Vitest)
npm run build # production build
```

## Legal

This is a personal hobby project. It is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC.

Bundled game content is limited to the System Reference Document 5.2.1:

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Application code is licensed under the [MIT License](LICENSE).
